from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import hashlib
import random
import string
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'complexionfit_db')]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

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
    created_at: datetime

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
    created_at: datetime = Field(default_factory=datetime.utcnow)

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

async def analyze_skin_with_ai(image_base64: str) -> Dict[str, Any]:
    """Use GPT-4o Vision to analyze skin from image"""
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"skin-analysis-{uuid.uuid4()}",
            system_message="""You are an expert dermatologist and makeup artist AI assistant. 
            Analyze the provided facial image and provide detailed skin analysis.
            
            You MUST respond in valid JSON format with these exact fields:
            {
                "skin_type": "one of: oily, dry, combination, normal, sensitive",
                "skin_tone": "one of: fair, light, medium, tan, deep, dark",
                "undertone": "one of: warm, cool, neutral",
                "face_shape": "one of: oval, round, square, heart, oblong, diamond",
                "skin_concerns": ["array of concerns like: acne, wrinkles, dark spots, redness, large pores, dullness, uneven texture, hyperpigmentation"],
                "texture_analysis": "brief description of skin texture",
                "ai_recommendations": [
                    {
                        "category": "foundation/concealer/blush/lipstick/skincare",
                        "recommendation": "specific product type recommendation",
                        "shade_range": "recommended shade range",
                        "tips": "application tips",
                        "reason": "why this suits their skin"
                    }
                ]
            }
            
            Provide at least 5 different recommendations covering foundation, concealer, blush, lipstick, and skincare.
            Be specific and helpful. Consider the person's unique features."""
        ).with_model("openai", "gpt-4o")
        
        # Create image content
        image_content = ImageContent(image_base64=image_base64)
        
        user_message = UserMessage(
            text="Please analyze this facial image and provide a complete skin analysis with makeup recommendations. Return ONLY valid JSON, no other text.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        logger.info(f"AI Response received: {response[:200]}...")
        
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
        
        analysis = json.loads(clean_response)
        return analysis
        
    except Exception as e:
        logger.error(f"AI Analysis error: {str(e)}")
        # Return default analysis if AI fails
        return {
            "skin_type": "combination",
            "skin_tone": "medium",
            "undertone": "neutral",
            "face_shape": "oval",
            "skin_concerns": ["general care needed"],
            "texture_analysis": "Unable to analyze - please try with a clearer photo",
            "ai_recommendations": [
                {
                    "category": "foundation",
                    "recommendation": "Medium coverage liquid foundation",
                    "shade_range": "Match to your jawline",
                    "tips": "Apply with a damp beauty sponge for natural finish",
                    "reason": "Versatile for most skin types"
                },
                {
                    "category": "skincare",
                    "recommendation": "Gentle daily moisturizer with SPF",
                    "shade_range": "N/A",
                    "tips": "Apply morning and night",
                    "reason": "Essential for all skin types"
                }
            ]
        }

# ==================== AUTH ENDPOINTS ====================

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
        "created_at": datetime.utcnow()
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
        "created_at": datetime.utcnow()
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
        "created_at": datetime.utcnow()
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
    analysis_result = await analyze_skin_with_ai(data.image_base64)
    
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
    await db.analyses.insert_one(analysis.dict())
    
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
        "created_at": datetime.utcnow()
    }
    
    await db.feedback.insert_one(feedback)
    
    return FeedbackResponse(**feedback)

@api_router.get("/feedback/{user_id}", response_model=List[FeedbackResponse])
async def get_user_feedback(user_id: str):
    """Get all feedback from a user"""
    feedback_list = await db.feedback.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    return [FeedbackResponse(**f) for f in feedback_list]

# ==================== UTILITY ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "ComplexionFit API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

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
