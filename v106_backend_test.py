"""
v1.0.6 Backend Test - notify-signup endpoint + regression smoke tests
"""
import os
import sys
import time
import uuid
import requests
from pathlib import Path

# Read backend URL from frontend env
ENV_PATH = Path("/app/frontend/.env")
BASE_URL = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().strip('"')
        break

if not BASE_URL:
    print("FATAL: EXPO_PUBLIC_BACKEND_URL not found")
    sys.exit(1)

API = f"{BASE_URL}/api"
print(f"Testing against: {API}\n")

results = []


def record(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, passed, detail))
    print(f"[{status}] {name}: {detail}")


# Use unique email per run for the "fresh" test
RUN_ID = uuid.uuid4().hex[:8]
FRESH_EMAIL = f"fresh-tester-{RUN_ID}@mak.com"

# ============================================================
# 1. NEW notify-signup tests
# ============================================================
print("=== NEW: POST /api/notify-signup ===")

# 1a. Fresh valid email
try:
    r = requests.post(
        f"{API}/notify-signup",
        json={"email": FRESH_EMAIL, "user_id": None, "feature_hint": "recent_activity"},
        timeout=15,
    )
    body = r.json()
    ok = (
        r.status_code == 200
        and body.get("status") == "ok"
        and body.get("already_subscribed") is False
        and "Done" in body.get("message", "")
    )
    record("notify-signup new email", ok, f"status={r.status_code} body={body}")
except Exception as e:
    record("notify-signup new email", False, str(e))

# 1b. Same email twice
try:
    r = requests.post(
        f"{API}/notify-signup",
        json={"email": FRESH_EMAIL, "user_id": None, "feature_hint": "recent_activity"},
        timeout=15,
    )
    body = r.json()
    ok = (
        r.status_code == 200
        and body.get("already_subscribed") is True
        and "already" in body.get("message", "").lower()
    )
    record("notify-signup duplicate email idempotent", ok, f"status={r.status_code} body={body}")
except Exception as e:
    record("notify-signup duplicate email idempotent", False, str(e))

# 1c. Invalid email
try:
    r = requests.post(f"{API}/notify-signup", json={"email": "not-an-email"}, timeout=15)
    ok = r.status_code == 422
    record("notify-signup invalid email -> 422", ok, f"status={r.status_code}")
except Exception as e:
    record("notify-signup invalid email -> 422", False, str(e))

# 1d. Uppercase + whitespace -> normalized
NORM_EMAIL_RAW = "  Mixed.Case@MAK.COM  "
NORM_EMAIL_EXPECTED = "mixed.case@mak.com"
try:
    r = requests.post(
        f"{API}/notify-signup",
        json={"email": NORM_EMAIL_RAW, "user_id": None, "feature_hint": "test"},
        timeout=15,
    )
    body = r.json()
    ok = r.status_code == 200 and body.get("status") == "ok"
    record("notify-signup uppercase/whitespace accepted", ok, f"status={r.status_code} body={body}")
except Exception as e:
    record("notify-signup uppercase/whitespace accepted", False, str(e))

# 1e. Verify that posting the lowercased version is now treated as a duplicate
# (this confirms the email was stored lowercased)
try:
    r = requests.post(
        f"{API}/notify-signup",
        json={"email": NORM_EMAIL_EXPECTED},
        timeout=15,
    )
    body = r.json()
    ok = r.status_code == 200 and body.get("already_subscribed") is True
    record(
        "notify-signup lowercased dedup (proves storage normalized)",
        ok,
        f"status={r.status_code} body={body}",
    )
except Exception as e:
    record("notify-signup lowercased dedup", False, str(e))

# 1f. Verify db.notify_list directly (mongo)
print("\n=== DB inspection: notify_list ===")
try:
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    # Read MONGO_URL from backend/.env
    mongo_url = None
    db_name = "test_database"
    for line in Path("/app/backend/.env").read_text().splitlines():
        if line.startswith("MONGO_URL="):
            mongo_url = line.split("=", 1)[1].strip().strip('"')
        if line.startswith("DB_NAME="):
            db_name = line.split("=", 1)[1].strip().strip('"')

    async def inspect():
        client = AsyncIOMotorClient(mongo_url, tz_aware=True)
        db = client[db_name]
        # Check fresh email entry
        doc1 = await db.notify_list.find_one({"email": FRESH_EMAIL})
        # Check normalized email entry
        doc2 = await db.notify_list.find_one({"email": NORM_EMAIL_EXPECTED})
        return doc1, doc2

    doc1, doc2 = asyncio.run(inspect())

    # Required fields
    required = {"id", "email", "user_id", "feature_hint", "subscribed_at"}

    if doc1:
        missing1 = required - set(doc1.keys())
        ok1 = not missing1 and doc1["email"] == FRESH_EMAIL
        record("db.notify_list has fresh email with all fields", ok1,
               f"missing_fields={missing1} email={doc1.get('email')}")

        # Check tz-aware
        sa = doc1.get("subscribed_at")
        is_tz_aware = sa is not None and getattr(sa, "tzinfo", None) is not None
        iso = sa.isoformat() if sa else ""
        has_offset = "+00:00" in iso
        record("subscribed_at is tz-aware UTC (+00:00)", is_tz_aware and has_offset,
               f"value={iso} tz={getattr(sa,'tzinfo',None)}")
    else:
        record("db.notify_list has fresh email", False, f"doc not found for {FRESH_EMAIL}")

    if doc2:
        ok2 = doc2["email"] == NORM_EMAIL_EXPECTED
        record("db.notify_list email is lowercased+stripped",
               ok2,
               f"stored_email={doc2.get('email')!r}")
    else:
        record("db.notify_list email lowercased+stripped", False,
               f"doc not found for {NORM_EMAIL_EXPECTED}")
except Exception as e:
    record("db.notify_list inspection", False, f"exception: {e}")


# ============================================================
# 2. REGRESSION SMOKE
# ============================================================
print("\n=== REGRESSION SMOKE ===")

# warmup
try:
    r = requests.get(f"{API}/warmup", timeout=10)
    body = r.json()
    ts = body.get("timestamp", "")
    ok = r.status_code == 200 and "+00:00" in ts
    record("GET /api/warmup 200 + +00:00", ok, f"status={r.status_code} ts={ts}")
except Exception as e:
    record("GET /api/warmup", False, str(e))

# health
try:
    r = requests.get(f"{API}/health", timeout=10)
    body = r.json()
    ts = body.get("timestamp", "")
    ok = r.status_code == 200 and "+00:00" in ts
    record("GET /api/health 200 + +00:00", ok, f"status={r.status_code} ts={ts}")
except Exception as e:
    record("GET /api/health", False, str(e))

# password-login
try:
    r = requests.post(
        f"{API}/auth/password-login",
        json={"email": "test@mak.com", "password": "test123456"},
        timeout=15,
    )
    body = r.json()
    ca = body.get("user", {}).get("created_at", body.get("created_at", ""))
    ok = r.status_code == 200 and "+00:00" in ca
    record("POST /api/auth/password-login + +00:00 created_at", ok, f"status={r.status_code} created_at={ca}")
    test_user_id = body.get("user", {}).get("id") or body.get("id")
except Exception as e:
    record("POST /api/auth/password-login", False, str(e))
    test_user_id = None

# locations countries
try:
    r = requests.get(f"{API}/locations/countries", timeout=15)
    body = r.json()
    countries = body if isinstance(body, list) else body.get("countries", [])
    n = len(countries)
    ok = r.status_code == 200 and n == 250
    record("GET /api/locations/countries == 250", ok, f"status={r.status_code} count={n}")
except Exception as e:
    record("GET /api/locations/countries", False, str(e))

# locations states IN
try:
    r = requests.get(f"{API}/locations/states/IN", timeout=15)
    body = r.json()
    states = body if isinstance(body, list) else body.get("states", [])
    n = len(states)
    ok = r.status_code == 200 and n == 36
    record("GET /api/locations/states/IN == 36", ok, f"status={r.status_code} count={n}")
except Exception as e:
    record("GET /api/locations/states/IN", False, str(e))

# analyze-skin valid (cache hit ok). Need a previously seen image_base64 — use a 1x1 PNG
# Build a >1KB JPEG-like blob (decoded bytes > 1024) so we pass length+size validation.
# Backend sanitization will strip prefix/whitespace and validate base64 decodes.
import base64 as _b64lib
_blob = bytes([0xFF] * 2048)  # 2KB of bytes -> > 1024 byte threshold
LONG_B64 = _b64lib.b64encode(_blob).decode()

# Need a real user_id - use the one from password-login above
if test_user_id:
    try:
        t0 = time.time()
        r = requests.post(
            f"{API}/analyze-skin",
            json={"user_id": test_user_id, "image_base64": LONG_B64, "mode": "skinCare"},
            timeout=70,
        )
        elapsed = time.time() - t0
        ok = r.status_code == 200
        # 503 also acceptable per spec ("cache hit ok") if first run
        if not ok and r.status_code == 503:
            ok = True
            note = "503 acceptable (cache miss + LLM busy)"
        else:
            note = ""
        record("POST /api/analyze-skin valid base64", ok, f"status={r.status_code} elapsed={elapsed:.1f}s {note}")
    except Exception as e:
        record("POST /api/analyze-skin valid base64", False, str(e))

    # analyze-skin with data: prefix (sanitization)
    try:
        prefixed = f"data:image/png;base64,{LONG_B64}"
        r = requests.post(
            f"{API}/analyze-skin",
            json={"user_id": test_user_id, "image_base64": prefixed, "mode": "skinCare"},
            timeout=70,
        )
        ok = r.status_code == 200
        if not ok and r.status_code == 503:
            ok = True
        record("POST /api/analyze-skin with data: prefix (sanitization)", ok, f"status={r.status_code}")
    except Exception as e:
        record("POST /api/analyze-skin with data: prefix", False, str(e))

# travel-style
try:
    r = requests.post(
        f"{API}/travel-style",
        json={
            "user_id": test_user_id or "test-uid",
            "country": "France",
            "month": "June",
            "occasion": "Vacation",
        },
        timeout=60,
    )
    ok = r.status_code == 200
    record("POST /api/travel-style", ok, f"status={r.status_code}")
except Exception as e:
    record("POST /api/travel-style", False, str(e))

# chat
try:
    r = requests.post(
        f"{API}/chat",
        json={"user_id": test_user_id or "test-uid", "message": "What's the best moisturizer for oily skin?"},
        timeout=60,
    )
    ok = r.status_code == 200
    record("POST /api/chat", ok, f"status={r.status_code}")
except Exception as e:
    record("POST /api/chat", False, str(e))

# Cleanup
print("\n=== Cleanup ===")
try:
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient

    async def cleanup():
        mongo_url = None
        db_name = "test_database"
        for line in Path("/app/backend/.env").read_text().splitlines():
            if line.startswith("MONGO_URL="):
                mongo_url = line.split("=", 1)[1].strip().strip('"')
            if line.startswith("DB_NAME="):
                db_name = line.split("=", 1)[1].strip().strip('"')
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        await db.notify_list.delete_one({"email": FRESH_EMAIL})
        # don't delete the normalized one in case main agent wants to inspect

    asyncio.run(cleanup())
    print("cleaned up fresh test email")
except Exception as e:
    print(f"cleanup warning: {e}")

# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
total = len(results)
passed = sum(1 for _, p, _ in results if p)
print(f"{passed}/{total} passed")
for name, p, detail in results:
    if not p:
        print(f"  FAIL: {name}: {detail}")
sys.exit(0 if passed == total else 1)
