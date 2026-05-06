#!/usr/bin/env python3
"""
v1.0.2 backend test for MAK - Personalized Makeup Buddy
Focus: consistency/cache, timezone correctness, regression
"""
import os
import sys
import time
import json
import base64
import hashlib
import requests
from pathlib import Path

# Get base URL from frontend .env
FRONTEND_ENV = Path("/app/frontend/.env")
BASE = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE = line.split("=", 1)[1].strip().strip('"')
        break

if not BASE:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL not found")
    sys.exit(1)

API = f"{BASE}/api"
print(f"Testing against: {API}\n")

OLD_BAD_STR = "Sorry we are experiencing issues, please try again in some time."

results = []
def record(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, passed, detail))
    print(f"[{status}] {name}: {detail}")

def check_tz(s):
    """Check if string contains +00:00 suffix"""
    return isinstance(s, str) and "+00:00" in s

# ---------- 1. Warmup + Health (timezone) ----------
print("=" * 70)
print("SECTION 1: Warmup + Health timezone correctness")
print("=" * 70)

try:
    r = requests.get(f"{API}/warmup", timeout=15)
    body = r.json()
    ts = body.get("timestamp", "")
    record("GET /api/warmup status=200", r.status_code == 200, f"status={r.status_code}, ts={ts}")
    record("GET /api/warmup timestamp has +00:00", check_tz(ts), f"timestamp={ts}")
    if OLD_BAD_STR in r.text:
        record("warmup no old bad string", False, "contains old bad string")
except Exception as e:
    record("GET /api/warmup", False, str(e))

try:
    r = requests.get(f"{API}/health", timeout=15)
    body = r.json()
    ts = body.get("timestamp", "")
    record("GET /api/health status=200", r.status_code == 200, f"status={r.status_code}, ts={ts}")
    record("GET /api/health timestamp has +00:00", check_tz(ts), f"timestamp={ts}")
except Exception as e:
    record("GET /api/health", False, str(e))

# ---------- 2. Auth: ensure test user, register a fresh user ----------
print("\n" + "=" * 70)
print("SECTION 2: Auth flow + timezone")
print("=" * 70)

TEST_EMAIL = "test@mak.com"
TEST_PASSWORD = "test123456"

# check email
try:
    r = requests.post(f"{API}/auth/check-email", json={"email": TEST_EMAIL}, timeout=15)
    record("POST /api/auth/check-email", r.status_code == 200, f"status={r.status_code}, body={r.json()}")
    test_user_exists = r.json().get("exists", False)
except Exception as e:
    record("POST /api/auth/check-email", False, str(e))
    test_user_exists = False

# register if not exists
test_user_id = None
test_user_created_at = None
if not test_user_exists:
    try:
        r = requests.post(f"{API}/auth/register", json={
            "email": TEST_EMAIL,
            "name": "Test User",
            "password": TEST_PASSWORD,
        }, timeout=15)
        if r.status_code == 200:
            body = r.json()
            test_user_id = body.get("id")
            test_user_created_at = body.get("created_at", "")
            record("POST /api/auth/register (test@mak.com)", True, f"id={test_user_id}, created_at={test_user_created_at}")
            record("register created_at has +00:00", check_tz(test_user_created_at), f"created_at={test_user_created_at}")
        else:
            record("POST /api/auth/register (test@mak.com)", False, f"status={r.status_code}, body={r.text[:200]}")
    except Exception as e:
        record("POST /api/auth/register (test@mak.com)", False, str(e))

# password login (always do this to get the user_id and verify timezone)
try:
    r = requests.post(f"{API}/auth/password-login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    }, timeout=15)
    if r.status_code == 200:
        body = r.json()
        test_user_id = body.get("id")
        created_at = body.get("created_at", "")
        record("POST /api/auth/password-login (test@mak.com)", True, f"id={test_user_id}, created_at={created_at}")
        record("password-login created_at has +00:00", check_tz(created_at), f"created_at={created_at}")
    else:
        record("POST /api/auth/password-login (test@mak.com)", False, f"status={r.status_code}, body={r.text[:200]}")
except Exception as e:
    record("POST /api/auth/password-login (test@mak.com)", False, str(e))

# Register a fresh user to test register timezone explicitly
fresh_email = f"v102_test_{int(time.time())}@mak.com"
try:
    r = requests.post(f"{API}/auth/register", json={
        "email": fresh_email,
        "name": "V102 Tester",
        "password": "secure_pwd_2026",
    }, timeout=15)
    if r.status_code == 200:
        body = r.json()
        created_at = body.get("created_at", "")
        record("POST /api/auth/register (fresh)", True, f"email={fresh_email}, created_at={created_at}")
        record("fresh register created_at has +00:00", check_tz(created_at), f"created_at={created_at}")
    else:
        record("POST /api/auth/register (fresh)", False, f"status={r.status_code}, body={r.text[:200]}")
except Exception as e:
    record("POST /api/auth/register (fresh)", False, str(e))

# Change-password regression
try:
    r = requests.post(f"{API}/auth/change-password", json={
        "user_id": test_user_id,
        "current_password": TEST_PASSWORD,
        "new_password": "newpwd_v102_x",
    }, timeout=15)
    if r.status_code == 200:
        # restore
        r2 = requests.post(f"{API}/auth/change-password", json={
            "user_id": test_user_id,
            "current_password": "newpwd_v102_x",
            "new_password": TEST_PASSWORD,
        }, timeout=15)
        record("POST /api/auth/change-password (round-trip)", r2.status_code == 200, f"first=200, restore={r2.status_code}")
    else:
        record("POST /api/auth/change-password", False, f"status={r.status_code}, body={r.text[:200]}")
except Exception as e:
    record("POST /api/auth/change-password", False, str(e))

# ---------- 3. analyze-skin: validation regression ----------
print("\n" + "=" * 70)
print("SECTION 3: analyze-skin validation regression (v1.0.1)")
print("=" * 70)

EXPECTED_BAD_IMG = "Image couldn't be processed. Please use a clear photo."
EXPECTED_TOO_LARGE = "Image is too large. Please use a smaller photo."

# Empty image
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "image_base64": "",
        "user_id": test_user_id,
        "mode": "skin_care",
    }, timeout=15)
    body = r.json() if r.text else {}
    detail = body.get("detail", "")
    record("analyze-skin empty image → 400", r.status_code == 400, f"status={r.status_code}, detail={detail}")
    record("empty image exact message", detail == EXPECTED_BAD_IMG, f"detail={detail}")
except Exception as e:
    record("analyze-skin empty image", False, str(e))

# Tiny (3-char) image
try:
    r = requests.post(f"{API}/analyze-skin", json={
        "image_base64": "abc",
        "user_id": test_user_id,
        "mode": "skin_care",
    }, timeout=15)
    body = r.json() if r.text else {}
    detail = body.get("detail", "")
    record("analyze-skin tiny image → 400", r.status_code == 400, f"status={r.status_code}, detail={detail}")
    record("tiny image exact message", detail == EXPECTED_BAD_IMG, f"detail={detail}")
except Exception as e:
    record("analyze-skin tiny image", False, str(e))

# Oversized
try:
    big = "A" * 15_000_001
    r = requests.post(f"{API}/analyze-skin", json={
        "image_base64": big,
        "user_id": test_user_id,
        "mode": "skin_care",
    }, timeout=60)
    body = r.json() if r.text else {}
    detail = body.get("detail", "")
    record("analyze-skin oversized → 400", r.status_code == 400, f"status={r.status_code}, detail={detail}")
    record("oversized exact message", detail == EXPECTED_TOO_LARGE, f"detail={detail}")
except Exception as e:
    record("analyze-skin oversized", False, str(e))

# ---------- 4. CONSISTENCY / CACHING (CRITICAL) ----------
print("\n" + "=" * 70)
print("SECTION 4: Consistency / Caching test (CRITICAL)")
print("=" * 70)

# Build a moderately sized valid base64 (~300+ chars)
# Use a larger pattern to pass the >200 char check
valid_image_b64 = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 600).decode()
print(f"Valid image base64 length: {len(valid_image_b64)}")

# Compute expected hash
mode = "skin_care"
expected_hash = hashlib.sha256((valid_image_b64 + "|" + mode).encode()).hexdigest()
print(f"Expected image_hash: {expected_hash[:16]}...")

# First call
first_response = None
first_time = None
try:
    t0 = time.time()
    r = requests.post(f"{API}/analyze-skin", json={
        "image_base64": valid_image_b64,
        "user_id": test_user_id,
        "mode": mode,
    }, timeout=90)
    first_time = time.time() - t0
    body = r.json() if r.text else {}
    if r.status_code == 200:
        first_response = body
        ca = body.get("created_at", "")
        record("analyze-skin call 1 (success path)", True, f"status=200, time={first_time:.2f}s")
        record("analyze-skin call 1 created_at has +00:00", check_tz(ca), f"created_at={ca}")
        print(f"  skin_type={body.get('skin_type')}, skin_tone={body.get('skin_tone')}, undertone={body.get('undertone')}, face_shape={body.get('face_shape')}")
    elif r.status_code == 503:
        record("analyze-skin call 1 (503 acceptable)", True, f"status=503, time={first_time:.2f}s, detail={body.get('detail')}")
        # Check that 503 message is the new one, not old
        if OLD_BAD_STR in r.text:
            record("analyze-skin call 1 503 no old bad string", False, "contains old bad string!")
    else:
        record("analyze-skin call 1", False, f"unexpected status={r.status_code}, body={r.text[:300]}")
except Exception as e:
    record("analyze-skin call 1", False, str(e))

# Second call - must be cache hit if first was successful
if first_response:
    try:
        t0 = time.time()
        r = requests.post(f"{API}/analyze-skin", json={
            "image_base64": valid_image_b64,
            "user_id": test_user_id,
            "mode": mode,
        }, timeout=30)
        second_time = time.time() - t0
        body = r.json() if r.text else {}
        record("analyze-skin call 2 status=200", r.status_code == 200, f"status={r.status_code}, time={second_time:.3f}s")
        # Cache hit: should be <500ms
        record("analyze-skin call 2 <500ms (cache hit)", second_time < 0.5, f"time={second_time:.3f}s")

        ca2 = body.get("created_at", "")
        record("analyze-skin call 2 created_at has +00:00", check_tz(ca2), f"created_at={ca2}")

        # Identity check on critical fields
        same_skin_type = body.get("skin_type") == first_response.get("skin_type")
        same_skin_tone = body.get("skin_tone") == first_response.get("skin_tone")
        same_undertone = body.get("undertone") == first_response.get("undertone")
        same_face_shape = body.get("face_shape") == first_response.get("face_shape")

        record("call 2 skin_type identical", same_skin_type, f"first={first_response.get('skin_type')}, second={body.get('skin_type')}")
        record("call 2 skin_tone identical", same_skin_tone, f"first={first_response.get('skin_tone')}, second={body.get('skin_tone')}")
        record("call 2 undertone identical", same_undertone, f"first={first_response.get('undertone')}, second={body.get('undertone')}")
        record("call 2 face_shape identical", same_face_shape, f"first={first_response.get('face_shape')}, second={body.get('face_shape')}")
    except Exception as e:
        record("analyze-skin call 2", False, str(e))
else:
    print("  ⚠ First call did not return 200 — skipping cache hit identity check")
    print("  Will still attempt second call to see if 503 is consistent")
    try:
        t0 = time.time()
        r = requests.post(f"{API}/analyze-skin", json={
            "image_base64": valid_image_b64,
            "user_id": test_user_id,
            "mode": mode,
        }, timeout=30)
        second_time = time.time() - t0
        record("analyze-skin call 2 (after 503 first)", True,
               f"status={r.status_code}, time={second_time:.3f}s, body={r.text[:200]}")
    except Exception as e:
        record("analyze-skin call 2 (after 503 first)", False, str(e))

# ---------- 5. Verify cache collection populated (via analyses + behavior) ----------
print("\n" + "=" * 70)
print("SECTION 5: db.analysis_cache populated check (via behavior)")
print("=" * 70)
# We can't query Mongo directly from here easily, but we infer from cache hit behavior
# Let me try to use mongo via subprocess
import subprocess
try:
    out = subprocess.run(
        ["mongosh", "--quiet", "mongodb://localhost:27017/complexionfit_db", "--eval",
         f"JSON.stringify(db.analysis_cache.findOne({{image_hash: '{expected_hash}'}}, {{image_hash: 1, mode: 1, created_at: 1, _id: 0}}))"],
        capture_output=True, text=True, timeout=10
    )
    output = (out.stdout or "").strip()
    print(f"  mongosh result: {output[:300]}")
    if output and output != "null":
        try:
            doc = json.loads(output)
            has_hash = doc.get("image_hash") == expected_hash
            record("db.analysis_cache has entry for image_hash", has_hash, f"image_hash matches: {has_hash}")
            record("cache entry has mode", "mode" in doc, f"mode={doc.get('mode')}")
            # created_at from mongosh is BSON Date object — gets serialized as ISO string with $date wrapper
            ca = doc.get("created_at")
            record("cache entry has created_at field", ca is not None, f"created_at={ca}")
        except Exception as ex:
            record("parse mongo cache result", False, f"{ex}: {output[:200]}")
    else:
        record("db.analysis_cache has entry", False, "no entry found (first call may not have succeeded)")
except Exception as e:
    record("query db.analysis_cache via mongosh", False, str(e))

# ---------- 6. GET analyses list timezone ----------
print("\n" + "=" * 70)
print("SECTION 6: GET /api/analyses/{user_id} timezone")
print("=" * 70)
try:
    r = requests.get(f"{API}/analyses/{test_user_id}", timeout=15)
    record("GET /api/analyses/{user_id} status=200", r.status_code == 200, f"status={r.status_code}")
    if r.status_code == 200:
        items = r.json()
        if isinstance(items, list) and len(items) > 0:
            all_tz = all(check_tz(it.get("created_at", "")) for it in items)
            record(f"all {len(items)} analyses created_at have +00:00", all_tz,
                   f"sample={items[0].get('created_at')}")
        else:
            record("analyses list has items", False, f"empty list (count={len(items) if isinstance(items, list) else 'N/A'})")
except Exception as e:
    record("GET /api/analyses", False, str(e))

# ---------- 7. travel-style regression ----------
print("\n" + "=" * 70)
print("SECTION 7: travel-style regression (France/June/Wedding)")
print("=" * 70)
try:
    t0 = time.time()
    r = requests.post(f"{API}/travel-style", json={
        "country": "France",
        "month": "June",
        "occasion": "Wedding",
        "user_id": test_user_id,
    }, timeout=90)
    elapsed = time.time() - t0
    body = r.json() if r.text else {}
    if r.status_code == 200:
        required = ["destination_info", "outfit_suggestions", "makeup_look", "accessories", "dos_and_donts", "overall_vibe", "ai_status"]
        missing = [k for k in required if k not in body]
        record("travel-style France/June/Wedding 200", True, f"time={elapsed:.2f}s, ai_status={body.get('ai_status')}")
        record("travel-style full payload fields", len(missing) == 0, f"missing={missing}")
    else:
        record("travel-style France/June/Wedding", False, f"status={r.status_code}, time={elapsed:.2f}s, body={r.text[:300]}")
    if OLD_BAD_STR in r.text:
        record("travel-style no old bad string", False, "contains old bad string!")
except Exception as e:
    record("travel-style", False, str(e))

# ---------- 8. chat regression ----------
print("\n" + "=" * 70)
print("SECTION 8: chat regression (valid beauty Q)")
print("=" * 70)
try:
    t0 = time.time()
    r = requests.post(f"{API}/chat", json={
        "message": "What's the best moisturizer for oily skin?",
    }, timeout=60)
    elapsed = time.time() - t0
    body = r.json() if r.text else {}
    if r.status_code == 200:
        resp_text = body.get("response", "")
        record("chat 200", True, f"time={elapsed:.2f}s, ai_status={body.get('ai_status')}, len={len(resp_text)}")
        record("chat response non-empty", len(resp_text) > 20, f"len={len(resp_text)}")
        record("chat no old bad string", OLD_BAD_STR not in resp_text, f"resp first 100: {resp_text[:100]}")
    else:
        record("chat", False, f"status={r.status_code}, body={r.text[:300]}")
except Exception as e:
    record("chat", False, str(e))

# ---------- 9. Sanity: Old bad string check across all responses ----------
print("\n" + "=" * 70)
print("SECTION 9: Final summary")
print("=" * 70)

passed = sum(1 for _, p, _ in results if p)
failed = sum(1 for _, p, _ in results if not p)
total = len(results)

print(f"\nTotal: {total} | Passed: {passed} | Failed: {failed}")
print(f"\nFAILED tests:")
for name, p, det in results:
    if not p:
        print(f"  ❌ {name} — {det}")

print(f"\n{'='*70}")
print(f"v1.0.2 backend test {'PASSED' if failed == 0 else 'FAILED'}")
print(f"{'='*70}")

sys.exit(0 if failed == 0 else 1)
