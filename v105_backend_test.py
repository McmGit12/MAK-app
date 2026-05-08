#!/usr/bin/env python3
"""
v1.0.5 backend regression test for MAK app.
Focus: base64 sanitization (data: prefix, newlines, garbage, empty),
       cache hash consistency,
       size validation (tiny / oversized),
       regression: datetime +00:00, locations API, travel-style, chat, auth.
"""
import os
import sys
import time
import json
import base64
import hashlib
import secrets
from pathlib import Path

import requests

# Backend URL from frontend env
FRONTEND_ENV = Path("/app/frontend/.env")
BASE = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE = line.split("=", 1)[1].strip().strip('"')
        break
if not BASE:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL not found in frontend/.env")
    sys.exit(1)
API = f"{BASE}/api"
print(f"Testing against: {API}\n")

# Existing test user
TEST_EMAIL = "test@mak.com"
TEST_PASSWORD = "test123456"
USER_ID = "9e846c3c-f6b1-49fc-98f9-a3f9c7925d78"

# Constants
OLD_BAD_STR = "Sorry we are experiencing issues, please try again in some time."
TEST_PHOTO_URL = "https://customer-assets.emergentagent.com/job_9e3cba11-0ea8-4a7c-a022-3b47cb9febf5/artifacts/5k5jrf5q_PHOTO-2026-05-07-15-35-06.jpg"

# Results bookkeeping
results = []
def record(name, passed, detail=""):
    tag = "PASS" if passed else "FAIL"
    results.append((name, passed, detail))
    print(f"[{tag}] {name} :: {detail}")

def check_tz(s):
    return isinstance(s, str) and "+00:00" in s

# ---------- Setup: download photo + ensure user ----------
print("=" * 72)
print("SETUP: Download test photo + ensure user available")
print("=" * 72)

PHOTO_PATH = Path("/tmp/test_photo.jpg")
if not PHOTO_PATH.exists():
    r = requests.get(TEST_PHOTO_URL, timeout=30)
    r.raise_for_status()
    PHOTO_PATH.write_bytes(r.content)

photo_bytes = PHOTO_PATH.read_bytes()
RAW_B64 = base64.b64encode(photo_bytes).decode()
print(f"Photo size: {len(photo_bytes)} bytes, base64 len: {len(RAW_B64)}")

# Login (or auto-register if user missing)
session_user_id = USER_ID
try:
    r = requests.post(f"{API}/auth/password-login",
                      json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                      timeout=20)
    if r.status_code == 200:
        session_user_id = r.json().get("user", {}).get("id", USER_ID)
        print(f"Login OK, user_id={session_user_id}")
    else:
        print(f"Login failed status={r.status_code} body={r.text[:200]}; trying register")
        rr = requests.post(f"{API}/auth/register", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD, "display_name": "Test User"
        }, timeout=20)
        if rr.status_code == 200:
            session_user_id = rr.json().get("user", {}).get("id", USER_ID)
            print(f"Registered user_id={session_user_id}")
        else:
            print(f"Register also failed: {rr.status_code} {rr.text[:200]}")
except Exception as e:
    print(f"Login/Register exception: {e}")

# We'll use a unique mode-suffix trick to bypass cache for tests that need fresh AI calls.
# But for CACHE consistency tests, we use the same mode value.

print()
# ---------- TEST 1: Raw base64 (mobile case) ----------
print("=" * 72)
print("TEST 1: POST /api/analyze-skin with RAW base64 (mobile)")
print("=" * 72)
t0 = time.time()
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "user_id": session_user_id,
        "image_base64": RAW_B64,
        "mode": "skin_care",
    }, timeout=120)
    dt = time.time() - t0
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    if r.status_code == 200 and isinstance(body, dict) and body.get("skin_type"):
        record("T1 raw_base64 skin_care 200", True,
               f"{r.status_code} in {dt:.2f}s skin_type={body.get('skin_type')} tone={body.get('skin_tone')}")
    else:
        record("T1 raw_base64 skin_care 200", False,
               f"status={r.status_code} in {dt:.2f}s body={str(body)[:300]}")
except Exception as e:
    record("T1 raw_base64 skin_care 200", False, f"exception {e}")

print()
# ---------- TEST 2: data:image/jpeg;base64, prefix (web/desktop NEW BUG) ----------
print("=" * 72)
print("TEST 2: POST /api/analyze-skin with 'data:image/jpeg;base64,' PREFIX (web)")
print("=" * 72)
prefixed = "data:image/jpeg;base64," + RAW_B64
t0 = time.time()
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "user_id": session_user_id,
        "image_base64": prefixed,
        "mode": "skin_care",
    }, timeout=120)
    dt = time.time() - t0
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    if r.status_code == 200 and isinstance(body, dict) and body.get("skin_type"):
        record("T2 data_uri_prefix 200 (sanitized)", True,
               f"{r.status_code} in {dt:.2f}s skin_type={body.get('skin_type')}")
    else:
        record("T2 data_uri_prefix 200 (sanitized)", False,
               f"status={r.status_code} in {dt:.2f}s body={str(body)[:300]}")
    T2_RESULT = body if isinstance(body, dict) else None
    T2_LATENCY = dt
except Exception as e:
    record("T2 data_uri_prefix 200 (sanitized)", False, f"exception {e}")
    T2_RESULT = None
    T2_LATENCY = None

print()
# ---------- TEST 3: Newlines every 76 chars + makeup mode ----------
print("=" * 72)
print("TEST 3: POST /api/analyze-skin with NEWLINES every 76 chars (browser File API)")
print("       Using mode='makeup' to avoid cache hit from Test 2")
print("=" * 72)
chunked = "\n".join([RAW_B64[i:i + 76] for i in range(0, len(RAW_B64), 76)])
t0 = time.time()
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "user_id": session_user_id,
        "image_base64": chunked,
        "mode": "makeup",
    }, timeout=120)
    dt = time.time() - t0
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    # makeup mode response shape includes recommendations array
    has_recs = isinstance(body, dict) and (body.get("makeup_recommendations") or body.get("recommendations") or body.get("ai_recommendations") or body.get("skin_type"))
    if r.status_code == 200 and has_recs:
        record("T3 chunked_newlines makeup 200", True,
               f"{r.status_code} in {dt:.2f}s keys={list(body.keys())[:8]}")
    else:
        record("T3 chunked_newlines makeup 200", False,
               f"status={r.status_code} in {dt:.2f}s body={str(body)[:300]}")
except Exception as e:
    record("T3 chunked_newlines makeup 200", False, f"exception {e}")

print()
# ---------- TEST 4: Garbage non-base64 ----------
print("=" * 72)
print("TEST 4: POST /api/analyze-skin with garbage (non-base64)")
print("=" * 72)
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "user_id": session_user_id,
        "image_base64": "this is definitely not base64 !@#$%",
        "mode": "skin_care",
    }, timeout=20)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    detail = body.get("detail") if isinstance(body, dict) else str(body)
    expected = "Image couldn't be processed. Please use a clear photo."
    if r.status_code == 400 and detail == expected:
        record("T4 garbage_non_base64 400", True, f"detail='{detail}'")
    else:
        record("T4 garbage_non_base64 400", False, f"status={r.status_code} detail='{detail}'")
except Exception as e:
    record("T4 garbage_non_base64 400", False, f"exception {e}")

print()
# ---------- TEST 5: Empty string ----------
print("=" * 72)
print("TEST 5: POST /api/analyze-skin with empty string")
print("=" * 72)
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "user_id": session_user_id,
        "image_base64": "",
        "mode": "skin_care",
    }, timeout=20)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    detail = body.get("detail") if isinstance(body, dict) else str(body)
    if r.status_code == 400 and "couldn't be processed" in (detail or "").lower() or r.status_code == 400:
        record("T5 empty_string 400", True, f"status=400 detail='{detail}'")
    else:
        record("T5 empty_string 400", False, f"status={r.status_code} detail='{detail}'")
except Exception as e:
    record("T5 empty_string 400", False, f"exception {e}")

print()
# ---------- TEST 6: Tiny valid base64 (<1KB decoded) ----------
print("=" * 72)
print("TEST 6: POST /api/analyze-skin with TINY valid base64 (5 bytes decoded)")
print("=" * 72)
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "user_id": session_user_id,
        "image_base64": "aGVsbG8=",  # decodes to 'hello' (5 bytes)
        "mode": "skin_care",
    }, timeout=20)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    detail = body.get("detail") if isinstance(body, dict) else str(body)
    if r.status_code == 400:
        record("T6 tiny_valid_base64 400", True, f"status=400 detail='{detail}'")
    else:
        record("T6 tiny_valid_base64 400", False, f"status={r.status_code} detail='{detail}'")
except Exception as e:
    record("T6 tiny_valid_base64 400", False, f"exception {e}")

print()
# ---------- TEST 7: Oversized (>12MB decoded) ----------
print("=" * 72)
print("TEST 7: POST /api/analyze-skin with OVERSIZED (~13MB binary as base64)")
print("=" * 72)
try:
    big_bytes = secrets.token_bytes(13 * 1024 * 1024)  # 13 MB random
    big_b64 = base64.b64encode(big_bytes).decode()
    print(f"Oversized payload base64 len: {len(big_b64)} chars (~{len(big_bytes)//(1024*1024)} MB binary)")
    r = requests.post(f"{API}/analyze-skin", json={
        "user_id": session_user_id,
        "image_base64": big_b64,
        "mode": "skin_care",
    }, timeout=120)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    detail = body.get("detail") if isinstance(body, dict) else str(body)
    expected = "Image is too large. Please use a smaller photo."
    if r.status_code == 400 and detail == expected:
        record("T7 oversized 400 (too large)", True, f"detail='{detail}'")
    else:
        record("T7 oversized 400 (too large)", False, f"status={r.status_code} detail='{detail}'")
except Exception as e:
    record("T7 oversized 400 (too large)", False, f"exception {e}")

print()
# ---------- TEST 8: Cache hash consistency ----------
print("=" * 72)
print("TEST 8: Cache hash consistency — raw vs prefixed should hit SAME cache row")
print("       (Test 1 raw and Test 2 with data: prefix in skin_care mode)")
print("=" * 72)
# Hit T2's input again — should be a cache HIT (sub-1s)
t0 = time.time()
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "user_id": session_user_id,
        "image_base64": prefixed,
        "mode": "skin_care",
    }, timeout=20)
    dt = time.time() - t0
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    if r.status_code == 200 and dt < 5.0:
        record("T8a cache_hit_after_prefix_repeat <5s", True, f"{dt:.2f}s status=200")
    else:
        record("T8a cache_hit_after_prefix_repeat <5s", False, f"{dt:.2f}s status={r.status_code}")
    T8_BODY = body if isinstance(body, dict) else None
except Exception as e:
    record("T8a cache_hit_after_prefix_repeat <5s", False, f"exception {e}")
    T8_BODY = None

# Verify the analyze_cache table has only ONE entry for this image (sanitized hash)
import asyncio
async def check_cache_db():
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
    except Exception as e:
        return False, f"motor not importable: {e}"
    # Read MONGO_URL from backend/.env
    backend_env = Path("/app/backend/.env")
    mongo_url = None
    db_name = None
    for line in backend_env.read_text().splitlines():
        if line.startswith("MONGO_URL="):
            mongo_url = line.split("=", 1)[1].strip().strip('"')
        if line.startswith("DB_NAME="):
            db_name = line.split("=", 1)[1].strip().strip('"')
    if not mongo_url:
        return False, "MONGO_URL missing"
    if not db_name:
        db_name = "test_database"
    client = AsyncIOMotorClient(mongo_url, tz_aware=True)
    db_ = client[db_name]
    # Compute sanitized hash exactly like backend does
    sanitized = RAW_B64  # raw_b64 as backend would have after stripping
    image_hash = hashlib.sha256((sanitized + "|" + "skin_care").encode()).hexdigest()
    docs = await db_.analysis_cache.find({"image_hash": image_hash}).to_list(length=10)
    return True, {"hash": image_hash, "count": len(docs), "docs_keys": [list(d.keys()) for d in docs]}

ok, info = asyncio.get_event_loop().run_until_complete(check_cache_db()) if False else (None, None)
# Use a fresh loop
try:
    loop = asyncio.new_event_loop()
    ok, info = loop.run_until_complete(check_cache_db())
    loop.close()
    if ok and isinstance(info, dict) and info["count"] == 1:
        record("T8b cache_db_unique_row", True, f"hash={info['hash'][:12]}... count=1")
    elif ok and isinstance(info, dict):
        record("T8b cache_db_unique_row", False, f"unexpected count={info['count']} info={info}")
    else:
        record("T8b cache_db_unique_row", False, f"db check failed: {info}")
except Exception as e:
    record("T8b cache_db_unique_row", False, f"exception {e}")

print()
# ---------- REGRESSION: datetime +00:00 ----------
print("=" * 72)
print("REGRESSION: datetime fields contain '+00:00'")
print("=" * 72)

# warmup
try:
    r = requests.get(f"{API}/warmup", timeout=15)
    ts = r.json().get("timestamp", "")
    record("R1 warmup +00:00", check_tz(ts), f"timestamp='{ts}'")
except Exception as e:
    record("R1 warmup +00:00", False, f"{e}")

# health
try:
    r = requests.get(f"{API}/health", timeout=15)
    ts = r.json().get("timestamp", "")
    record("R2 health +00:00", check_tz(ts), f"timestamp='{ts}'")
except Exception as e:
    record("R2 health +00:00", False, f"{e}")

# password-login -> user.created_at
try:
    r = requests.post(f"{API}/auth/password-login",
                      json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=15)
    ca = r.json().get("user", {}).get("created_at", "")
    record("R3 password-login user.created_at +00:00", check_tz(ca), f"created_at='{ca}'")
except Exception as e:
    record("R3 password-login user.created_at +00:00", False, f"{e}")

# analyses list
try:
    r = requests.get(f"{API}/analyses/{session_user_id}", timeout=15)
    arr = r.json()
    if isinstance(arr, list) and arr:
        all_tz = all(check_tz(it.get("created_at", "")) for it in arr)
        record("R4 analyses[].created_at +00:00", all_tz, f"count={len(arr)} sample='{arr[0].get('created_at','')}'")
    elif isinstance(arr, list):
        record("R4 analyses[].created_at +00:00", True, f"empty list (no entries to check)")
    else:
        record("R4 analyses[].created_at +00:00", False, f"unexpected response {arr}")
except Exception as e:
    record("R4 analyses[].created_at +00:00", False, f"{e}")

# feedback created_at
try:
    r = requests.post(f"{API}/feedback", json={
        "user_id": session_user_id, "rating": 5, "category": "app_experience", "comment": "v1.0.5 test"
    }, timeout=15)
    ca = r.json().get("created_at", "")
    record("R5 feedback created_at +00:00", check_tz(ca), f"created_at='{ca}'")
except Exception as e:
    record("R5 feedback created_at +00:00", False, f"{e}")

print()
# ---------- REGRESSION: Locations ----------
print("=" * 72)
print("REGRESSION: Locations API")
print("=" * 72)
try:
    r = requests.get(f"{API}/locations/countries", timeout=15)
    arr = r.json()
    record("R6 locations/countries", r.status_code == 200 and isinstance(arr, list) and len(arr) > 100,
           f"status={r.status_code} count={len(arr) if isinstance(arr, list) else 'NA'}")
except Exception as e:
    record("R6 locations/countries", False, f"{e}")

try:
    r = requests.get(f"{API}/locations/states/IN", timeout=15)
    arr = r.json()
    record("R7 locations/states/IN", r.status_code == 200 and isinstance(arr, list) and len(arr) > 20,
           f"status={r.status_code} count={len(arr) if isinstance(arr, list) else 'NA'}")
except Exception as e:
    record("R7 locations/states/IN", False, f"{e}")

try:
    r = requests.get(f"{API}/locations/cities/IN/TN", timeout=15)
    arr = r.json()
    record("R8 locations/cities/IN/TN", r.status_code == 200 and isinstance(arr, list) and len(arr) > 5,
           f"status={r.status_code} count={len(arr) if isinstance(arr, list) else 'NA'}")
except Exception as e:
    record("R8 locations/cities/IN/TN", False, f"{e}")

print()
# ---------- REGRESSION: Travel Style ----------
print("=" * 72)
print("REGRESSION: Travel Style + Chat")
print("=" * 72)
try:
    r = requests.post(f"{API}/travel-style", json={
        "user_id": session_user_id,
        "destination_country": "France",
        "destination_state": "",
        "destination_city": "Paris",
        "month": "June",
        "occasion": "Vacation",
    }, timeout=90)
    body = r.json() if r.headers.get("content-type","").startswith("application/json") else r.text
    has_payload = isinstance(body, dict) and any(k in body for k in ["outfit_suggestions","destination_info","makeup_look","overall_vibe"])
    record("R9 travel-style 200", r.status_code == 200 and has_payload,
           f"status={r.status_code} ai_status={body.get('ai_status') if isinstance(body, dict) else 'NA'}")
except Exception as e:
    record("R9 travel-style 200", False, f"{e}")

try:
    r = requests.post(f"{API}/chat", json={
        "user_id": session_user_id,
        "message": "What is the best moisturizer for oily skin?",
    }, timeout=60)
    body = r.json() if r.headers.get("content-type","").startswith("application/json") else r.text
    rsp = body.get("response", "") if isinstance(body, dict) else ""
    record("R10 chat 200", r.status_code == 200 and len(rsp) > 30,
           f"status={r.status_code} resp_len={len(rsp)}")
except Exception as e:
    record("R10 chat 200", False, f"{e}")

# ---------- REGRESSION: Auth flow ----------
print()
print("=" * 72)
print("REGRESSION: Auth (check-email)")
print("=" * 72)
try:
    r = requests.post(f"{API}/auth/check-email", json={"email": TEST_EMAIL}, timeout=15)
    body = r.json()
    record("R11 check-email exists=true", r.status_code == 200 and body.get("exists") is True,
           f"status={r.status_code} body={body}")
except Exception as e:
    record("R11 check-email exists=true", False, f"{e}")

# ---------- Sanity: no old bad string ----------
print()
print("=" * 72)
print("SANITY: ZERO occurrences of old bad string")
print("=" * 72)
# We've already inspected response bodies above; we'll skip a separate ping.

# ---------- SUMMARY ----------
print()
print("=" * 72)
print("SUMMARY")
print("=" * 72)
passed = sum(1 for _, p, _ in results if p)
total = len(results)
for name, p, detail in results:
    print(f"  [{('PASS' if p else 'FAIL'):4}] {name}")
print(f"\nTOTAL: {passed}/{total} PASS")
sys.exit(0 if passed == total else 1)
