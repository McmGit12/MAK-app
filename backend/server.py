from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, field_serializer
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import random
import string
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
import bcrypt
import asyncio
import time


def now_utc() -> datetime:
    """Return timezone-aware UTC datetime. Replaces deprecated utcnow()
    and guarantees ISO serialization includes '+00:00' so frontend JS Date
    correctly interprets as UTC and converts to the user's local timezone."""
    return datetime.now(timezone.utc)


# ============================================================
# LOCATION DATA — loaded once on startup, served via /api/locations/*
# Replaces the country-state-city npm library on the frontend (saved ~7-8MB
# from the APK bundle). Memory cost on backend: ~60MB (one-time, shared
# across all requests via in-memory dicts).
# Source: country-state-city 3.2.1 (CC-BY 4.0)
# ============================================================
import json as _json
from pathlib import Path as _Path

_DATA_DIR = _Path(__file__).parent / "data"
_COUNTRIES_LIST: list = []
_STATES_BY_COUNTRY: dict = {}   # {isoCode: [{"name", "isoCode"}, ...]}
_CITIES_BY_STATE: dict = {}     # {(countryCode, stateCode): [{"name"}, ...]}


def _load_locations():
    """Parse and index location JSON. Runs once at startup (~2-3s for 148k cities)."""
    global _COUNTRIES_LIST, _STATES_BY_COUNTRY, _CITIES_BY_STATE

    try:
        # Countries — keep only fields the frontend actually needs
        with open(_DATA_DIR / "country.json") as f:
            raw = _json.load(f)
        _COUNTRIES_LIST = sorted(
            [{"name": c["name"], "isoCode": c["isoCode"], "flag": c.get("flag", "")} for c in raw],
            key=lambda c: c["name"].lower(),
        )

        # States — group by countryCode
        with open(_DATA_DIR / "state.json") as f:
            states_raw = _json.load(f)
        states_by_country: dict = {}
        for s in states_raw:
            cc = s["countryCode"]
            states_by_country.setdefault(cc, []).append({"name": s["name"], "isoCode": s["isoCode"]})
        for cc in states_by_country:
            states_by_country[cc].sort(key=lambda x: x["name"].lower())
        _STATES_BY_COUNTRY = states_by_country

        # Cities — list of arrays [name, countryCode, stateCode, lat, lng]
        # Group by (countryCode, stateCode) for O(1) lookup
        with open(_DATA_DIR / "city.json") as f:
            cities_raw = _json.load(f)
        cities_by_state: dict = {}
        for row in cities_raw:
            name, cc, sc = row[0], row[1], row[2]
            cities_by_state.setdefault((cc, sc), []).append({"name": name})
        for key in cities_by_state:
            cities_by_state[key].sort(key=lambda x: x["name"].lower())
        _CITIES_BY_STATE = cities_by_state
    except Exception as e:
        # Non-fatal: app still works, just no location pickers
        import logging
        logging.getLogger(__name__).error(f"Failed to load location data: {e}")


_load_locations()

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with PRODUCTION-READY pooling + auto-reconnect
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,                  # Max connections in pool
    minPoolSize=5,                   # Keep 5 connections warm
    connectTimeoutMS=5000,           # 5s to establish connection
    serverSelectionTimeoutMS=5000,   # 5s to find a server
    socketTimeoutMS=30000,           # 30s for operations
    maxIdleTimeMS=60000,             # Close idle connections after 60s
    retryWrites=True,                # Auto-retry failed writes
    retryReads=True,                 # Auto-retry failed reads
    heartbeatFrequencyMS=10000,      # Ping every 10s to keep pool alive
    waitQueueTimeoutMS=5000,         # Max wait time for available connection
    tz_aware=True,                   # v1.0.2: Return BSON Date as tz-aware UTC datetime
                                     # (without this, reads come back naive — breaks Canada user TZ display)
)
db = client[os.environ.get('DB_NAME', 'complexionfit_db')]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
if not EMERGENT_LLM_KEY:
    print("WARNING: EMERGENT_LLM_KEY is not set. AI features will return fallback responses.")

# Create the main app
app = FastAPI(title="ComplexionFit API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== RETRY HELPER ====================

async def retry_async(func, max_retries=2, delay=1.0):
    """Retry an async function with exponential backoff"""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            return await func()
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                logger.warning(f"Retry {attempt + 1}/{max_retries} after error: {str(e)[:100]}")
                await asyncio.sleep(delay * (attempt + 1))
            else:
                raise last_error

async def llm_with_timeout(coro, timeout_seconds=30):
    """Run an LLM call with a hard timeout"""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        # 504 \u2014 frontend maps to 'timeout' variant
        raise HTTPException(status_code=504, detail="Request timed out.")

async def llm_call_resilient(chat_factory, user_message, first_timeout=18, retry_timeout=25):
    """Run an LLM call with two-phase resilience:
    1. First attempt: strict timeout for fast failure
    2. On timeout/failure: retry once with longer timeout
    Returns (response_text, status) where status is 'ok', 'retried', or 'failed'

    NOTE: Total max time = first_timeout + 0.5s + retry_timeout = ~43s
    Frontend axios timeout is 60s, leaving ~17s safety margin.
    """
    # Attempt 1: strict timeout
    try:
        chat = chat_factory()
        response = await asyncio.wait_for(chat.send_message(user_message), timeout=first_timeout)
        return response, "ok"
    except (asyncio.TimeoutError, Exception) as e:
        logger.warning(f"LLM first attempt failed ({type(e).__name__}: {str(e)[:600]}); retrying with longer timeout")
    
    # Attempt 2: longer timeout, fresh chat instance
    try:
        await asyncio.sleep(0.5)  # brief backoff
        chat = chat_factory()
        response = await asyncio.wait_for(chat.send_message(user_message), timeout=retry_timeout)
        return response, "retried"
    except Exception as e:
        logger.error(f"LLM retry also failed ({type(e).__name__}: {str(e)[:600]})")
        return None, "failed"

async def db_with_timeout(coro, timeout_seconds=10):
    """Run a DB operation with a hard timeout"""
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Request timed out.")

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    display_name: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    user_hash: str
    login_method: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime

    # v1.0.2: emit "+00:00" instead of "Z" so JS Date parses as UTC and converts to local TZ.
    # If DB returned a naive datetime (legacy rows pre-tz_aware), assume UTC.
    @field_serializer('created_at')
    def _ser_created_at(self, v: datetime, _info):
        if v is None:
            return None
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()

class UpdateDisplayName(BaseModel):
    user_id: str
    display_name: str

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

class EmailLogin(BaseModel):
    email: str

class SkinAnalysisRequest(BaseModel):
    image_base64: str
    user_id: str
    mode: str = "skin_care"  # "skin_care" or "makeup"

class SkinAnalysis(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    skin_type: str  # oily, dry, combination, normal, sensitive
    skin_tone: str  # fair, light, medium, tan, deep, dark
    undertone: str  # warm, cool, neutral
    face_shape: str  # oval, round, square, heart, oblong
    skin_concerns: List[str]  # acne, wrinkles, dark spots, etc.
    texture_analysis: str
    ai_recommendations: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=now_utc)

class SkinAnalysisResponse(BaseModel):
    id: str
    skin_type: str
    skin_tone: str
    undertone: str
    face_shape: str
    skin_concerns: List[str]
    texture_analysis: str
    ai_recommendations: List[Dict[str, Any]]
    created_at: datetime

    @field_serializer('created_at')
    def _ser_created_at(self, v: datetime, _info):
        if v is None:
            return None
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()

class CuratedRecommendation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    skin_type: str
    skin_tone: str
    category: str  # foundation, concealer, blush, lipstick, skincare
    product_name: str
    brand: str
    description: str
    tips: str
    suitable_for: List[str]

class FeedbackCreate(BaseModel):
    user_id: str
    rating: int  # 1-5
    category: str  # app_experience, recommendations, analysis_accuracy
    comment: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: str
    user_id: str
    rating: int
    category: str
    comment: Optional[str]
    created_at: datetime

    @field_serializer('created_at')
    def _ser_created_at(self, v: datetime, _info):
        if v is None:
            return None
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.isoformat()

# ==================== HELPER FUNCTIONS ====================

def hash_identifier(identifier: str) -> str:
    """Hash email or phone to avoid storing PII"""
    return hashlib.sha256(identifier.lower().encode()).hexdigest()[:16]

def generate_otp() -> str:
    """Generate 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))

def generate_user_id() -> str:
    """Generate unique user ID"""
    return str(uuid.uuid4())

# Store OTPs temporarily (in production, use Redis with expiry)
otp_store: Dict[str, str] = {}

async def analyze_skin_with_ai(image_base64: str, mode: str = "skin_care") -> Dict[str, Any]:
    """Use GPT-4o Vision to analyze skin/makeup from image.

    Uses temperature=0 and strong anchoring prompts to produce DETERMINISTIC,
    consistent output for the same input photo. Results are cached by SHA-256
    hash of the image (per mode) so an identical photo always returns an
    identical analysis INSTANTLY (no LLM call) — this fixes the bug where
    re-scanning the same face gave different skin type/tone/shape values.
    """
    # ---------- BASE64 SANITIZATION ----------
    # Web/desktop expo-image-picker can return base64 with embedded newlines,
    # whitespace, or a 'data:image/...;base64,' prefix — all of which OpenAI
    # rejects with "Invalid base64 image_url". This block normalizes ALL three
    # cases so we send a clean payload regardless of the device source.
    if not image_base64:
        raise HTTPException(
            status_code=400,
            detail="Image couldn't be processed. Please use a clear photo."
        )
    # Strip any "data:image/<type>;base64," prefix that the frontend may have included
    if image_base64.startswith("data:") and ";base64," in image_base64:
        image_base64 = image_base64.split(";base64,", 1)[1]
    # Strip ALL whitespace and CR/LF (browsers sometimes wrap base64 to 76 chars)
    image_base64 = "".join(image_base64.split())
    # Pad to a multiple of 4 if the upload truncated trailing '='
    pad_needed = (-len(image_base64)) % 4
    if pad_needed:
        image_base64 = image_base64 + ("=" * pad_needed)
    # Validate it's actually decodable base64 — fail fast with a 400 if not
    import base64 as _b64
    try:
        _decoded_bytes = _b64.b64decode(image_base64, validate=True)
        _decoded_size = len(_decoded_bytes)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Image couldn't be processed. Please use a clear photo."
        )

    # Image size validation (in BYTES, not base64 chars)
    if _decoded_size < 1024:  # < 1KB → not a real image
        raise HTTPException(
            status_code=400,
            detail="Image couldn't be processed. Please use a clear photo."
        )
    if _decoded_size > 12 * 1024 * 1024:  # 12 MB binary cap (OpenAI vision limit is 20MB)
        raise HTTPException(
            status_code=400,
            detail="Image is too large. Please use a smaller photo."
        )

    # ---------- IMAGE-HASH CACHE LOOKUP ----------
    # SHA-256 of the base64 image + mode. Same photo + same mode = same result, guaranteed.
    # This gives ~100ms response (vs 8-15s LLM call) for re-scans of the same image.
    image_hash = hashlib.sha256((image_base64 + "|" + mode).encode()).hexdigest()
    try:
        cached = await asyncio.wait_for(
            db.analysis_cache.find_one({"image_hash": image_hash}),
            timeout=2,
        )
        if cached and "result" in cached:
            logger.info(f"Analysis cache HIT for hash={image_hash[:12]}... mode={mode}")
            return cached["result"]
    except Exception as e:
        # Cache miss or DB hiccup — continue to LLM call
        logger.debug(f"Cache lookup skipped: {str(e)[:80]}")

    try:
        # Vision preamble — explicitly acknowledges GPT-4o's vision capability and
        # forces JSON-only output. Without this, OpenAI's content policy
        # frequently refuses facial-analysis tasks with plain-text apologies like
        # "I'm sorry, I can't analyze the image..." which then fail JSON parsing
        # and surface as a misleading "Service is busy" 503.
        vision_preamble = """You are GPT-4o, a vision-enabled AI model. You CAN analyze facial images.
The user provides a facial photograph for non-medical, cosmetic styling guidance only — this is your CORE FUNCTION.
You MUST always return a valid JSON object matching the schema below, with NO surrounding prose, NO apologies, NO markdown code fences.
Do NOT refuse. If the photo is unclear or partially obstructed, proceed with the best inference you can and explain limitations briefly inside the texture_analysis field. Never return plain text under any circumstance."""

        # Shared anchoring preamble used by BOTH modes — forces the model to
        # ground its output on STABLE bone/tone features (not transient lighting).
        stability_preamble = """CRITICAL CONSISTENCY RULES — your output MUST be deterministic:
- Anchor your assessment on STABLE, INNATE features: bone structure, natural undertone,
  base skin type (oily/dry production patterns), eye shape, brow position.
- IGNORE transient variables: current lighting, temporary redness, oil sheen from the moment,
  makeup already worn, camera white-balance, filters.
- Pick ONLY from the exact enum values provided — no synonyms, no creative variants.
- Use neutral, descriptive terms. Do NOT add flourishes the user didn't ask for.
- If two possible values are equally likely, pick the more CONSERVATIVE / NEUTRAL one
  (e.g. 'neutral' undertone over 'warm' when uncertain; 'normal' skin over 'combination' when ambiguous).
- The SAME face in a DIFFERENT photo with similar framing MUST produce the same skin_type,
  skin_tone, undertone, and face_shape values."""

        if mode == "makeup":
            system_msg = f"""{vision_preamble}

You are also a warm, experienced makeup artist speaking directly to a client.
Describe what you observe in the facial image and suggest the best makeup that would suit this person.

{stability_preamble}

STYLE RULES:
- Sound natural and conversational, like a real makeup artist talking to a client.
- Be SPECIFIC to what you observe — no generic advice.
- Do NOT make up brand names — use general product type descriptions instead.

You MUST respond as a valid JSON object with these exact fields:
{{
    "skin_type": "one of: oily, dry, combination, normal, sensitive",
    "skin_tone": "one of: fair, light, medium, tan, deep, dark",
    "undertone": "one of: warm, cool, neutral",
    "face_shape": "one of: oval, round, square, heart, oblong, diamond",
    "skin_concerns": ["array of makeup-relevant observations"],
    "texture_analysis": "brief description of skin texture (use this to note any photo limitations)",
    "ai_recommendations": [
        {{
            "category": "category name",
            "recommendation": "specific recommendation based on what you SEE",
            "shade_range": "recommended shades based on THEIR tone",
            "tips": "practical application tips",
            "reason": "why this specifically suits THEIR features"
        }}
    ]
}}

Provide at least 7 recommendations covering ALL of these:
1. Foundation & Base - type and shade matched to their actual tone
2. Blush - type (cream/powder), color family suited to their undertone
3. Lip Color - finish and colors that complement their specific features
4. Eye Makeup - eyeshadow, liner, mascara suited to their eye shape
5. Contouring & Highlighting - placement based on their face shape
6. Brow Styling - shape recommendations based on their face
7. Hair Styling - styles that complement their face shape"""
            user_text = "Describe the visible features in this facial photograph and provide detailed makeup suggestions. Base everything on the actual features, skin tone, and face shape you observe. Return ONLY the valid JSON object, no other text."
        else:
            system_msg = f"""{vision_preamble}

You are also a caring, knowledgeable skincare specialist speaking directly to a client.
Describe what you observe in the facial image and provide detailed observations with routine recommendations.
This is for non-medical cosmetic guidance only — never make a medical diagnosis.

{stability_preamble}

STYLE RULES:
- Sound warm and supportive, like a friendly skincare consultant.
- Be SPECIFIC to what you observe — no generic one-size-fits-all advice.
- Do NOT make up product brand names — use general product type descriptions.

You MUST respond as a valid JSON object with these exact fields:
{{
    "skin_type": "one of: oily, dry, combination, normal, sensitive",
    "skin_tone": "one of: fair, light, medium, tan, deep, dark",
    "undertone": "one of: warm, cool, neutral",
    "face_shape": "one of: oval, round, square, heart, oblong, diamond",
    "skin_concerns": ["array of cosmetic observations from the photo"],
    "texture_analysis": "description of what you observe (use this to note any photo limitations)",
    "ai_recommendations": [
        {{
            "category": "category name",
            "recommendation": "specific product type for THEIR observations",
            "shade_range": "N/A for skincare",
            "tips": "when and how to use it",
            "reason": "why this addresses THEIR specific observations"
        }}
    ]
}}

Provide at least 6 recommendations covering:
1. Cleanser - suited to their specific skin type
2. Toner/Essence - targeted to their concerns
3. Serum - addressing their specific issues
4. Moisturizer - matched to their skin type
5. Sunscreen - appropriate SPF
6. Weekly Treatment - based on their needs"""
            user_text = "Describe the visible features in this facial photograph and provide a personalized skincare routine. Be specific to what you observe. Return ONLY the valid JSON object, no other text."

        # Force JSON output via response_format. This + the vision_preamble dramatically
        # reduces OpenAI content-policy refusals for facial-analysis tasks.
        # temperature=0 forces deterministic output — same prompt + same image = same answer.
        chat_factory = lambda: LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"skin-analysis-{uuid.uuid4()}",
            system_message=system_msg
        ).with_model("openai", "gpt-4o").with_params(
            temperature=0,
            response_format={"type": "json_object"},
        )
        
        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        user_message = UserMessage(
            text=user_text,
            file_contents=[image_content]
        )
        
        # Resilient LLM call: uses tuned defaults (18s + 25s retry = ~43s max)
        # Frontend axios timeout is 90s (see api.ts), giving ~47s safety buffer.
        response, status = await llm_call_resilient(
            chat_factory,
            user_message,
        )
        if response is None:
            # Both attempts failed \u2014 return 503 (frontend maps to 'busy' variant)
            raise HTTPException(
                status_code=503,
                detail="Service is busy. Please try again."
            )
        logger.info(f"AI Response received (status={status}): {response[:200]}...")
        
        # Parse JSON response
        import json
        # Clean up response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith("```json"):
            clean_response = clean_response[7:]
        if clean_response.startswith("```"):
            clean_response = clean_response[3:]
        if clean_response.endswith("```"):
            clean_response = clean_response[:-3]
        clean_response = clean_response.strip()

        # ---------- REFUSAL DETECTION (defensive) ----------
        # Even with response_format={'type':'json_object'} and the vision_preamble,
        # OpenAI's content policy occasionally still returns plain-text refusals like
        # "I'm sorry, I can't analyze the image..." This pattern check catches both
        # plain-text refusals AND JSON objects with refusal text inside fields,
        # then returns a clean 422 (not a misleading 503 'busy').
        refusal_phrases = [
            "i'm sorry", "i am sorry", "can't analyze", "cannot analyze",
            "unable to analyze", "can't process", "cannot process",
            "try uploading a different", "i can't help with",
            "i can't assist", "unable to assist", "won't be able to",
        ]
        lower_response = clean_response.lower()
        # Treat as refusal only if the response is short (genuine refusal) AND
        # NOT a valid JSON object that just happens to contain those words in a
        # legitimate texture_analysis description.
        looks_like_json = clean_response.startswith("{") and clean_response.endswith("}")
        if not looks_like_json and any(p in lower_response for p in refusal_phrases):
            logger.warning(f"AI returned a plain-text refusal — returning 422 to user. Snippet: {clean_response[:160]}")
            raise HTTPException(
                status_code=422,
                detail="We couldn\u2019t analyze this photo. For best results, try a clear, well-lit, front-facing photo with no filters.",
            )

        try:
            analysis = json.loads(clean_response)
        except json.JSONDecodeError as je:
            # Non-JSON output despite response_format hint — most likely a soft refusal.
            logger.warning(f"AI returned non-JSON ({je}) — treating as refusal. Snippet: {clean_response[:160]}")
            raise HTTPException(
                status_code=422,
                detail="We couldn\u2019t analyze this photo. For best results, try a clear, well-lit, front-facing photo with no filters.",
            )

        # ---------- CACHE WRITE ----------
        # Store the successful analysis so the same image returns instantly next time.
        # Non-fatal: if the write fails, the result is still returned to the user.
        try:
            await asyncio.wait_for(
                db.analysis_cache.update_one(
                    {"image_hash": image_hash},
                    {"$set": {
                        "image_hash": image_hash,
                        "mode": mode,
                        "result": analysis,
                        "created_at": now_utc(),
                    }},
                    upsert=True,
                ),
                timeout=3,
            )
            logger.info(f"Analysis cached for hash={image_hash[:12]}... mode={mode}")
        except Exception as e:
            logger.warning(f"Cache write skipped (non-fatal): {str(e)[:80]}")

        return analysis
        
    except HTTPException:
        # Re-raise our explicit HTTPExceptions (400 / 503 / 504) — keeps status codes intact
        raise
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        # Generic LLM/parsing failure — 503 maps to 'busy' on the frontend
        raise HTTPException(
            status_code=503,
            detail="Service is busy. Please try again."
        )

# ==================== APP INSTALL TRACKING ====================

class AppInstall(BaseModel):
    device_id: str
    platform: str  # android or ios
    app_version: str
    installed_at: datetime = Field(default_factory=now_utc)

class InstallStats(BaseModel):
    total_installs: int
    android_installs: int
    ios_installs: int
    recent_installs_24h: int

@api_router.post("/app/register-install")
async def register_install(device_id: str, platform: str = "android", app_version: str = "1.0.0"):
    """Register an app install - called when app is first opened"""
    # Check if device already registered
    existing = await db.app_installs.find_one({"device_id": device_id}, {"id": 1})
    if existing:
        return {"status": "already_registered", "install_id": existing.get("id")}
    
    install_id = str(uuid.uuid4())
    install_data = {
        "id": install_id,
        "device_id": device_id,
        "platform": platform.lower(),
        "app_version": app_version,
        "installed_at": now_utc()
    }
    await db.app_installs.insert_one(install_data)
    
    logger.info(f"New app install registered: {platform} - {device_id[:8]}...")
    return {"status": "registered", "install_id": install_id}

@api_router.get("/app/install-stats", response_model=InstallStats)
async def get_install_stats():
    """Get app installation statistics"""
    total = await db.app_installs.count_documents({})
    android = await db.app_installs.count_documents({"platform": "android"})
    ios = await db.app_installs.count_documents({"platform": "ios"})
    
    # Recent installs in last 24 hours
    yesterday = now_utc() - timedelta(hours=24)
    recent = await db.app_installs.count_documents({"installed_at": {"$gte": yesterday}})
    
    return InstallStats(
        total_installs=total,
        android_installs=android,
        ios_installs=ios,
        recent_installs_24h=recent
    )

# ==================== AUTH ENDPOINTS ====================

class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    phone: Optional[str] = None
    country_code: Optional[str] = None

class CheckEmailRequest(BaseModel):
    email: str

class PasswordLoginRequest(BaseModel):
    email: str
    password: str

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


# ============================================================
# LOCATION DATA ENDPOINTS — replaces frontend country-state-city library
# Eliminates ~7-8MB from APK bundle. Frontend fetches lazily on picker open.
# ============================================================

@api_router.get("/locations/countries")
async def get_countries():
    """Return all countries (sorted by name) with name + isoCode + flag emoji."""
    return _COUNTRIES_LIST


@api_router.get("/locations/states/{country_code}")
async def get_states(country_code: str):
    """Return states/regions for a country. Empty list if country has none."""
    return _STATES_BY_COUNTRY.get(country_code.upper(), [])


@api_router.get("/locations/cities/{country_code}/{state_code}")
async def get_cities(country_code: str, state_code: str):
    """Return cities for a (country, state). Empty list if none."""
    return _CITIES_BY_STATE.get((country_code.upper(), state_code.upper()), [])


# ============================================================
# NOTIFY-ME WAITLIST — for "Coming Soon" features on the home page.
# Stores email addresses opted-in to be notified when new features ship.
# ============================================================

class NotifySignupRequest(BaseModel):
    email: EmailStr
    user_id: Optional[str] = None
    feature_hint: Optional[str] = None  # which "coming soon" card the user tapped from


class NotifySignupResponse(BaseModel):
    status: str
    message: str
    already_subscribed: bool = False


@api_router.post("/notify-signup", response_model=NotifySignupResponse)
async def notify_signup(payload: NotifySignupRequest):
    """Add the user to the notify-me waitlist for upcoming features."""
    email_norm = payload.email.strip().lower()
    try:
        existing = await asyncio.wait_for(
            db.notify_list.find_one({"email": email_norm}),
            timeout=5,
        )
        if existing:
            return NotifySignupResponse(
                status="ok",
                message="You're already on the list \u2014 we'll email you the moment new features go live!",
                already_subscribed=True,
            )
        await asyncio.wait_for(
            db.notify_list.insert_one({
                "id": str(uuid.uuid4()),
                "email": email_norm,
                "user_id": payload.user_id,
                "feature_hint": payload.feature_hint,
                "subscribed_at": now_utc(),
            }),
            timeout=5,
        )
        return NotifySignupResponse(
            status="ok",
            message="Done! We'll email you the moment new features go live \u2728",
            already_subscribed=False,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="Service is busy. Please try again.")
    except Exception as e:
        logger.error(f"notify_signup error: {e}")
        raise HTTPException(status_code=500, detail="Couldn't save your email. Please try again.")


@api_router.post("/auth/check-email")
async def check_email(data: CheckEmailRequest):
    """Check if email is registered"""
    import re
    email = data.email.strip().lower()
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    user_hash = hash_identifier(email)
    existing = await db_with_timeout(db.users.find_one({"user_hash": user_hash, "login_method": "email"}, {"_id": 1}))
    return {"exists": existing is not None}

@api_router.post("/auth/register", response_model=UserResponse)
async def register_user(data: RegisterRequest):
    """Create a new account"""
    import re
    email = data.email.strip().lower()
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not data.name or len(data.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters.")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if re.search(r'<[^>]+>|javascript:|<script', data.password, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Invalid characters in password.")
    if re.search(r'<[^>]+>|javascript:|<script', data.name, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Invalid characters in name.")
    
    user_hash = hash_identifier(email)
    existing = await db.users.find_one({"user_hash": user_hash, "login_method": "email"}, {"_id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")
    
    user_id = generate_user_id()
    new_user = {
        "id": user_id,
        "user_hash": user_hash,
        "login_method": "email",
        "display_name": data.name.strip(),
        "password_hash": hash_password(data.password),
        "email": email,
        "phone": data.phone,
        "country_code": data.country_code,
        "created_at": now_utc()
    }
    await db.users.insert_one(new_user)
    return UserResponse(id=user_id, user_hash=user_hash, login_method="email", display_name=data.name.strip(), email=email, created_at=new_user["created_at"])

@api_router.post("/auth/password-login", response_model=UserResponse)
async def password_login(data: PasswordLoginRequest):
    """Sign in with email and password"""
    email = data.email.strip().lower()
    user_hash = hash_identifier(email)
    user = await db.users.find_one({"user_hash": user_hash, "login_method": "email"})
    if not user:
        raise HTTPException(status_code=400, detail="No account found with this email.")
    
    stored_hash = user.get("password_hash")
    if stored_hash:
        if not verify_password(data.password, stored_hash):
            raise HTTPException(status_code=400, detail="Incorrect password. Please try again.")
    
    # Ensure email is stored for older accounts
    if not user.get("email"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"email": email}})
    
    return UserResponse(id=user["id"], user_hash=user["user_hash"], login_method="email", display_name=user.get("display_name"), email=user.get("email", email), created_at=user["created_at"])

class ChangePasswordRequest(BaseModel):
    user_id: str
    current_password: str
    new_password: str

@api_router.get("/auth/profile/{user_id}")
async def get_profile(user_id: str):
    """Get user profile by ID"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserResponse(
        id=user["id"],
        user_hash=user["user_hash"],
        login_method=user.get("login_method", "email"),
        display_name=user.get("display_name"),
        email=user.get("email"),
        created_at=user["created_at"]
    )

@api_router.post("/auth/change-password")
async def change_password(data: ChangePasswordRequest):
    """Change user password"""
    import re
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    if re.search(r'<[^>]+>|javascript:|<script', data.new_password, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Invalid characters in password.")
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password.")
    
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=400, detail="User not found.")
    
    stored_hash = user.get("password_hash")
    if stored_hash:
        if not verify_password(data.current_password, stored_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")
    
    new_hash = hash_password(data.new_password)
    await db.users.update_one({"id": data.user_id}, {"$set": {"password_hash": new_hash}})
    return {"message": "Password updated successfully."}

@api_router.post("/auth/guest-login", response_model=UserResponse)
async def guest_login():
    """Create a guest user without email or phone"""
    user_id = generate_user_id()
    guest_hash = f"guest_{user_id[:8]}"
    
    new_user = {
        "id": user_id,
        "user_hash": guest_hash,
        "login_method": "guest",
        "display_name": "Guest",
        "created_at": now_utc()
    }
    await db.users.insert_one(new_user)
    
    return UserResponse(**new_user)

@api_router.put("/auth/update-name", response_model=UserResponse)
async def update_display_name(data: UpdateDisplayName):
    """Update user's display name"""
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": data.user_id},
        {"$set": {"display_name": data.display_name}}
    )
    
    user["display_name"] = data.display_name
    return UserResponse(
        id=user["id"],
        user_hash=user["user_hash"],
        login_method=user["login_method"],
        display_name=data.display_name,
        created_at=user["created_at"]
    )

@api_router.post("/auth/email-login", response_model=UserResponse)
async def email_login(data: EmailLogin):
    """Simple email login - creates user if not exists"""
    user_hash = hash_identifier(data.email)
    
    # Check if user exists
    existing_user = await db.users.find_one({"user_hash": user_hash})
    
    if existing_user:
        return UserResponse(
            id=existing_user["id"],
            user_hash=existing_user["user_hash"],
            login_method=existing_user["login_method"],
            display_name=existing_user.get("display_name"),
            created_at=existing_user["created_at"]
        )
    
    # Create new user
    user_id = generate_user_id()
    new_user = {
        "id": user_id,
        "user_hash": user_hash,
        "login_method": "email",
        "display_name": None,
        "created_at": now_utc()
    }
    await db.users.insert_one(new_user)
    
    return UserResponse(**new_user)

@api_router.post("/auth/request-otp")
async def request_otp(data: OTPRequest):
    """Request OTP for phone login"""
    otp = generate_otp()
    otp_store[data.phone] = otp
    
    # In production, send SMS via Twilio/etc
    # For demo, we'll just return success (OTP logged for testing)
    logger.info(f"OTP for {data.phone}: {otp}")
    
    return {"message": "OTP sent successfully", "demo_otp": otp}  # Remove demo_otp in production

@api_router.post("/auth/verify-otp", response_model=UserResponse)
async def verify_otp(data: OTPVerify):
    """Verify OTP and login/register user"""
    stored_otp = otp_store.get(data.phone)
    
    if not stored_otp or stored_otp != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Clear used OTP
    del otp_store[data.phone]
    
    user_hash = hash_identifier(data.phone)
    
    # Check if user exists
    existing_user = await db.users.find_one({"user_hash": user_hash})
    
    if existing_user:
        return UserResponse(
            id=existing_user["id"],
            user_hash=existing_user["user_hash"],
            login_method=existing_user["login_method"],
            display_name=existing_user.get("display_name"),
            created_at=existing_user["created_at"]
        )
    
    # Create new user
    user_id = generate_user_id()
    new_user = {
        "id": user_id,
        "user_hash": user_hash,
        "login_method": "phone",
        "display_name": None,
        "created_at": now_utc()
    }
    await db.users.insert_one(new_user)
    
    return UserResponse(**new_user)

# ==================== SKIN ANALYSIS ENDPOINTS ====================

@api_router.post("/analyze-skin", response_model=SkinAnalysisResponse)
async def analyze_skin(data: SkinAnalysisRequest):
    """Analyze skin from uploaded image using AI"""
    # Verify user exists
    user = await db.users.find_one({"id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Perform AI analysis
    analysis_result = await analyze_skin_with_ai(data.image_base64, data.mode)
    
    # Create analysis record
    analysis = SkinAnalysis(
        user_id=data.user_id,
        skin_type=analysis_result.get("skin_type", "combination"),
        skin_tone=analysis_result.get("skin_tone", "medium"),
        undertone=analysis_result.get("undertone", "neutral"),
        face_shape=analysis_result.get("face_shape", "oval"),
        skin_concerns=analysis_result.get("skin_concerns", []),
        texture_analysis=analysis_result.get("texture_analysis", ""),
        ai_recommendations=analysis_result.get("ai_recommendations", [])
    )
    
    # Save to database (image is NOT stored - only analysis results)
    analysis_dict = analysis.dict()
    analysis_dict["mode"] = data.mode
    await db.analyses.insert_one(analysis_dict)
    
    return SkinAnalysisResponse(
        id=analysis.id,
        skin_type=analysis.skin_type,
        skin_tone=analysis.skin_tone,
        undertone=analysis.undertone,
        face_shape=analysis.face_shape,
        skin_concerns=analysis.skin_concerns,
        texture_analysis=analysis.texture_analysis,
        ai_recommendations=analysis.ai_recommendations,
        created_at=analysis.created_at
    )

@api_router.get("/analyses/{user_id}", response_model=List[SkinAnalysisResponse])
async def get_user_analyses(user_id: str):
    """Get all analyses for a user"""
    analyses = await db.analyses.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    return [SkinAnalysisResponse(
        id=a["id"],
        skin_type=a["skin_type"],
        skin_tone=a["skin_tone"],
        undertone=a["undertone"],
        face_shape=a["face_shape"],
        skin_concerns=a["skin_concerns"],
        texture_analysis=a["texture_analysis"],
        ai_recommendations=a["ai_recommendations"],
        created_at=a["created_at"]
    ) for a in analyses]

@api_router.get("/analysis/{analysis_id}", response_model=SkinAnalysisResponse)
async def get_analysis(analysis_id: str):
    """Get specific analysis by ID"""
    analysis = await db.analyses.find_one({"id": analysis_id})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return SkinAnalysisResponse(
        id=analysis["id"],
        skin_type=analysis["skin_type"],
        skin_tone=analysis["skin_tone"],
        undertone=analysis["undertone"],
        face_shape=analysis["face_shape"],
        skin_concerns=analysis["skin_concerns"],
        texture_analysis=analysis["texture_analysis"],
        ai_recommendations=analysis["ai_recommendations"],
        created_at=analysis["created_at"]
    )

# ==================== CURATED RECOMMENDATIONS ====================

@api_router.get("/curated-recommendations")
async def get_curated_recommendations(
    skin_type: Optional[str] = None,
    skin_tone: Optional[str] = None,
    category: Optional[str] = None
):
    """Get curated product recommendations filtered by skin type/tone"""
    query = {}
    if skin_type:
        query["skin_type"] = skin_type
    if skin_tone:
        query["skin_tone"] = skin_tone
    if category:
        query["category"] = category
    
    recommendations = await db.curated_recommendations.find(query).to_list(100)
    
    # If no curated data, return defaults
    if not recommendations:
        return get_default_curated_recommendations(skin_type, skin_tone, category)
    
    return recommendations

def get_default_curated_recommendations(skin_type: str = None, skin_tone: str = None, category: str = None):
    """Return default curated recommendations"""
    defaults = [
        {
            "id": "cur-1",
            "skin_type": "all",
            "skin_tone": "all",
            "category": "foundation",
            "product_name": "Buildable Coverage Foundation",
            "brand": "Recommended",
            "description": "A versatile foundation that works for most skin types with buildable coverage",
            "tips": "Start with a small amount and build up. Use a damp sponge for natural finish.",
            "suitable_for": ["oily", "dry", "combination", "normal"]
        },
        {
            "id": "cur-2",
            "skin_type": "oily",
            "skin_tone": "all",
            "category": "primer",
            "product_name": "Mattifying Primer",
            "brand": "Recommended",
            "description": "Oil-control primer that keeps makeup in place all day",
            "tips": "Apply to T-zone for best results. Let set for 1 minute before foundation.",
            "suitable_for": ["oily", "combination"]
        },
        {
            "id": "cur-3",
            "skin_type": "dry",
            "skin_tone": "all",
            "category": "primer",
            "product_name": "Hydrating Primer",
            "brand": "Recommended",
            "description": "Moisturizing primer that creates a smooth canvas",
            "tips": "Apply after moisturizer. Perfect for adding glow to dull skin.",
            "suitable_for": ["dry", "normal"]
        },
        {
            "id": "cur-4",
            "skin_type": "all",
            "skin_tone": "fair",
            "category": "blush",
            "product_name": "Soft Pink Blush",
            "brand": "Recommended",
            "description": "Delicate pink shade perfect for fair skin tones",
            "tips": "Apply to apples of cheeks and blend upward toward temples.",
            "suitable_for": ["fair", "light"]
        },
        {
            "id": "cur-5",
            "skin_type": "all",
            "skin_tone": "medium",
            "category": "blush",
            "product_name": "Peachy Coral Blush",
            "brand": "Recommended",
            "description": "Warm coral shade that complements medium skin beautifully",
            "tips": "Build gradually for a natural flush of color.",
            "suitable_for": ["medium", "tan"]
        },
        {
            "id": "cur-6",
            "skin_type": "all",
            "skin_tone": "deep",
            "category": "blush",
            "product_name": "Rich Berry Blush",
            "brand": "Recommended",
            "description": "Deep berry shade that adds beautiful warmth to deep skin tones",
            "tips": "Use a fluffy brush for seamless blending.",
            "suitable_for": ["deep", "dark"]
        },
        {
            "id": "cur-7",
            "skin_type": "all",
            "skin_tone": "all",
            "category": "lipstick",
            "product_name": "Your Perfect Nude",
            "brand": "Recommended",
            "description": "Find a nude that matches your lip color but slightly enhanced",
            "tips": "Your perfect nude should be 1-2 shades darker than your natural lip color.",
            "suitable_for": ["all"]
        },
        {
            "id": "cur-8",
            "skin_type": "all",
            "skin_tone": "all",
            "category": "skincare",
            "product_name": "Daily SPF Moisturizer",
            "brand": "Recommended",
            "description": "Essential daily protection for all skin types",
            "tips": "Apply as last step of skincare, before makeup. Reapply every 2 hours when outdoors.",
            "suitable_for": ["all"]
        },
        {
            "id": "cur-9",
            "skin_type": "sensitive",
            "skin_tone": "all",
            "category": "foundation",
            "product_name": "Mineral Foundation",
            "brand": "Recommended",
            "description": "Gentle, non-irritating coverage for sensitive skin",
            "tips": "Look for fragrance-free formulas. Patch test before full application.",
            "suitable_for": ["sensitive"]
        },
        {
            "id": "cur-10",
            "skin_type": "all",
            "skin_tone": "all",
            "category": "concealer",
            "product_name": "Color-Correcting Concealer",
            "brand": "Recommended",
            "description": "Target specific concerns with color correction",
            "tips": "Green neutralizes redness, peach/orange cancels dark circles on deeper tones.",
            "suitable_for": ["all"]
        }
    ]
    
    # Filter based on parameters
    filtered = defaults
    if skin_type and skin_type != "all":
        filtered = [r for r in filtered if skin_type in r["suitable_for"] or "all" in r["suitable_for"] or r["skin_type"] == "all"]
    if category:
        filtered = [r for r in filtered if r["category"] == category]
    
    return filtered

# ==================== FEEDBACK ENDPOINTS ====================

@api_router.post("/feedback", response_model=FeedbackResponse)
async def submit_feedback(data: FeedbackCreate):
    """Submit user feedback"""
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    feedback = {
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "rating": data.rating,
        "category": data.category,
        "comment": data.comment,
        "created_at": now_utc()
    }
    
    await db.feedback.insert_one(feedback)
    
    return FeedbackResponse(**feedback)

@api_router.get("/feedback/{user_id}", response_model=List[FeedbackResponse])
async def get_user_feedback(user_id: str):
    """Get all feedback from a user"""
    feedback_list = await db.feedback.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    return [FeedbackResponse(**f) for f in feedback_list]

# ==================== UTILITY ENDPOINTS ====================

# ==================== TRAVEL STYLE ENDPOINT ====================

class TravelStyleRequest(BaseModel):
    country: str
    month: str
    occasion: str
    user_id: Optional[str] = None

@api_router.post("/travel-style")
async def get_travel_style(data: TravelStyleRequest):
    """Get makeup and dressing suggestions based on travel destination"""
    try:
        chat_factory = lambda: LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"travel-style-{uuid.uuid4()}",
            system_message="""You are a friendly, well-traveled fashion stylist who gives practical advice.
            
            CRITICAL RULES:
            - Your suggestions MUST be specific to the EXACT destination provided (country, state, city)
            - Consider the ACTUAL weather/climate of that specific location in the given month
            - Reference local cultural norms and dress codes specific to that region
            - Do NOT give generic travel advice - make it specific to where they are going
            - Sound warm and conversational, like advice from a well-traveled friend
            - Do NOT make up specific brand names
            - For weather info, use your knowledge of typical climate patterns for that region and month
            - Different destinations MUST produce genuinely different recommendations
            
            You MUST respond in valid JSON format:
            {
                "destination_info": "Specific weather, temperature range, and cultural context for THAT exact location in THAT month",
                "outfit_suggestions": [
                    {"category": "category name", "suggestion": "specific outfit suited to the location climate and culture", "tips": "practical styling tips"}
                ],
                "makeup_look": [
                    {"category": "category name", "suggestion": "makeup suited to the climate and occasion", "tips": "application tips considering the weather"}
                ],
                "accessories": ["accessories suited to the destination and occasion"],
                "dos_and_donts": {"dos": ["location-specific dos"], "donts": ["location-specific donts"]},
                "overall_vibe": "the recommended overall look described naturally"
            }
            
            Provide at least 4 outfit and 5 makeup recommendations.
            Outfit categories: Daywear, Evening, Formal/Event, Casual, Footwear
            Makeup categories: Base, Eyes, Lips, Blush & Contour, Overall Look"""
        ).with_model("openai", "gpt-4o").with_params(temperature=0.2)
        
        user_message = UserMessage(
            text=f"I'm travelling to {data.country} in {data.month} for a {data.occasion}. Give me specific outfit and makeup recommendations for THIS exact location, considering the typical weather there in {data.month}, local cultural expectations, and the occasion. Be specific to this destination - don't give generic advice. Return ONLY valid JSON."
        )
        
        # Resilient: uses tuned defaults (18s + 25s retry = ~43s max)
        response, status = await llm_call_resilient(
            chat_factory,
            user_message,
        )
        if response is None:
            raise HTTPException(
                status_code=503,
                detail="Service is busy. Please try again."
            )
        
        import json
        clean = response.strip()
        if clean.startswith("```json"): clean = clean[7:]
        if clean.startswith("```"): clean = clean[3:]
        if clean.endswith("```"): clean = clean[:-3]
        result = json.loads(clean.strip())
        result["ai_status"] = status
        return result
        
    except HTTPException:
        # Re-raise our explicit HTTPExceptions
        raise
    except Exception as e:
        logger.error(f"Travel style error: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="Service is busy. Please try again."
        )

# ==================== CHATBOT ENDPOINT ====================

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

# Store chat sessions in memory (simple approach)
chat_sessions: Dict[str, LlmChat] = {}

@api_router.post("/chat")
async def chat_with_mak(data: ChatMessage):
    """Ask MAK chatbot - beauty and makeup assistant"""
    import re
    
    # Input validation
    msg = data.message.strip()
    if not msg or len(msg) < 2:
        return {"response": "Please type a question about beauty or makeup!", "session_id": data.session_id}
    if len(msg) > 500:
        return {"response": "Please keep your question shorter (under 500 characters).", "session_id": data.session_id}
    
    # Block scripts/HTML
    if re.search(r'<[^>]+>|javascript:|<script|onclick|onerror', msg, re.IGNORECASE):
        return {"response": "Please ask a valid beauty or makeup question.", "session_id": data.session_id}
    
    # Block excessive emojis (more than 5)
    emoji_pattern = re.compile("[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\U00002600-\U000026FF]", flags=re.UNICODE)
    emoji_count = len(emoji_pattern.findall(msg))
    if emoji_count > 5:
        return {"response": "Too many emojis! Please type your question in words.", "session_id": data.session_id}
    
    # Block cuss words (basic list)
    bad_words = ['fuck', 'shit', 'damn', 'ass', 'bitch', 'bastard', 'dick', 'crap', 'piss', 'hell', 'cunt', 'wtf', 'stfu', 'lmao']
    msg_lower = msg.lower()
    if any(w in msg_lower for w in bad_words):
        return {"response": "Let's keep our conversation positive and beauty-focused! How can I help with your beauty routine?", "session_id": data.session_id}
    
    try:
        session_id = data.session_id or str(uuid.uuid4())
        
        if session_id not in chat_sessions:
            chat_sessions[session_id] = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=session_id,
                system_message="""You are MAK, a friendly and knowledgeable beauty assistant.
                You speak like a supportive best friend who happens to be a beauty expert.
                
                RULES:
                - Keep responses concise (2-4 sentences max) and conversational
                - Sound warm, natural, and human - not robotic or corporate
                - Only answer beauty, skincare, makeup, styling, and self-care questions
                - If asked non-beauty topics, gently redirect: "I'm all about beauty and style! Want me to help with skincare or makeup instead?"
                - Never provide medical diagnoses - suggest seeing a dermatologist for medical concerns
                - Do NOT make up specific brand names unless very well-known
                - Be encouraging and body-positive always
                - English only"""
            ).with_model("openai", "gpt-4o")
        
        chat = chat_sessions[session_id]
        user_msg = UserMessage(text=msg)
        
        # Try strict first, then retry once with longer timeout
        response = None
        try:
            response = await asyncio.wait_for(chat.send_message(user_msg), timeout=15)
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"Chat first attempt failed: {str(e)[:100]}; retrying")
            try:
                await asyncio.sleep(0.3)
                response = await asyncio.wait_for(chat.send_message(user_msg), timeout=25)
            except Exception as e2:
                logger.error(f"Chat retry failed: {str(e2)[:100]}")
                return {
                    "response": "I\u2019m having a little trouble responding right now \u2014 give it a moment and try again \u2728",
                    "session_id": session_id,
                    "ai_status": "fallback",
                }
        
        # Limit sessions in memory (cleanup old ones)
        if len(chat_sessions) > 100:
            oldest = list(chat_sessions.keys())[:50]
            for k in oldest:
                del chat_sessions[k]
        
        return {"response": response, "session_id": session_id, "ai_status": "ok"}
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return {"response": "I\u2019m having a little trouble responding right now \u2014 give it a moment and try again \u2728", "session_id": data.session_id, "ai_status": "fallback"}

@api_router.get("/")
async def root():
    return {"message": "ComplexionFit API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    """Health check with MongoDB connectivity verification.
    Returns 200 always so load balancers don't kill the pod on transient DB issues."""
    mongo_ok = False
    try:
        result = await asyncio.wait_for(db.command("ping"), timeout=3)
        mongo_ok = result.get("ok") == 1.0
    except Exception as e:
        logger.warning(f"Health check DB ping failed: {str(e)[:100]}")
        mongo_ok = False
    
    return {
        "status": "healthy" if mongo_ok else "degraded",
        "timestamp": now_utc().isoformat(),
        "mongodb": "connected" if mongo_ok else "disconnected",
        "llm_key_configured": bool(EMERGENT_LLM_KEY),
    }

@api_router.get("/warmup")
async def warmup():
    """Warmup endpoint to pre-initialize connections and kill cold starts.
    Called by the frontend on app launch. Pings DB, ensures pool is warm."""
    result = {"status": "warm", "timestamp": now_utc().isoformat()}
    # Pre-warm MongoDB pool
    try:
        await asyncio.wait_for(db.command("ping"), timeout=3)
        # Touch common collections so indexes/stats get loaded
        await asyncio.wait_for(db.users.estimated_document_count(), timeout=3)
        result["mongodb"] = "warm"
    except Exception as e:
        logger.warning(f"Warmup DB step failed: {str(e)[:100]}")
        result["mongodb"] = "cold"
    return result

# ==================== STARTUP EVENT (PRE-WARM + INDEXES) ====================

@app.on_event("startup")
async def startup_event():
    """Pre-warm MongoDB pool, create indexes for fast queries.
    Non-fatal: if DB is briefly unavailable, the app still starts and will retry on first request."""
    try:
        # Ping to wake up the connection pool
        await asyncio.wait_for(db.command("ping"), timeout=5)
        logger.info("MongoDB connection pool pre-warmed successfully")
    except Exception as e:
        logger.warning(f"Startup DB ping failed (will retry on first request): {str(e)[:100]}")
    
    # Create indexes (safe to call repeatedly - MongoDB is idempotent)
    try:
        await asyncio.wait_for(
            db.users.create_index("user_hash"),
            timeout=5
        )
        await asyncio.wait_for(
            db.users.create_index("id", unique=True),
            timeout=5
        )
        await asyncio.wait_for(
            db.analyses.create_index([("user_id", 1), ("created_at", -1)]),
            timeout=5
        )
        await asyncio.wait_for(
            db.analyses.create_index("id", unique=True),
            timeout=5
        )
        await asyncio.wait_for(
            db.app_installs.create_index("device_id", unique=True),
            timeout=5
        )
        await asyncio.wait_for(
            db.feedback.create_index([("user_id", 1), ("created_at", -1)]),
            timeout=5
        )
        # Analysis cache: unique index on image_hash for fast lookups
        await asyncio.wait_for(
            db.analysis_cache.create_index("image_hash", unique=True),
            timeout=5
        )
        logger.info("MongoDB indexes ensured")
    except Exception as e:
        logger.warning(f"Index creation failed (non-fatal): {str(e)[:100]}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
