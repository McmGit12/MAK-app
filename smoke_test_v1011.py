#!/usr/bin/env python3
"""
v1.0.11 Quick Smoke Regression — iOS submission readiness.
Tests 8 core endpoints per review request.
"""
import requests
import base64
import time
import sys

BASE_URL = "https://mak-makeup-buddy.preview.emergentagent.com/api"
TEST_PHOTO_URL = "https://customer-assets.emergentagent.com/job_9e3cba11-0ea8-4a7c-a022-3b47cb9febf5/artifacts/5k5jrf5q_PHOTO-2026-05-07-15-35-06.jpg"

results = []


def report(name, passed, details=""):
    icon = "✅" if passed else "❌"
    print(f"{icon} {name}: {details}")
    results.append((name, passed, details))


def test_1_health():
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=15)
        if r.status_code != 200:
            report("1. GET /api/health", False, f"HTTP {r.status_code}")
            return
        j = r.json()
        mongo_ok = j.get("mongodb") == "connected"
        llm_ok = j.get("llm_key_configured") is True
        ts = j.get("timestamp", "")
        tz_ok = "+00:00" in ts
        passed = mongo_ok and llm_ok and tz_ok
        report("1. GET /api/health", passed,
               f"status={j.get('status')}, mongodb={j.get('mongodb')}, llm_key={j.get('llm_key_configured')}, tz_ok={tz_ok}, ts={ts}")
    except Exception as e:
        report("1. GET /api/health", False, f"Exception: {e}")


def test_2_warmup():
    try:
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/warmup", timeout=15)
        elapsed = time.time() - t0
        if r.status_code != 200:
            report("2. GET /api/warmup", False, f"HTTP {r.status_code}")
            return
        j = r.json()
        ts = j.get("timestamp", "")
        tz_ok = "+00:00" in ts
        report("2. GET /api/warmup", tz_ok,
               f"status={j.get('status')}, mongodb={j.get('mongodb')}, tz_ok={tz_ok}, elapsed={elapsed:.2f}s, ts={ts}")
    except Exception as e:
        report("2. GET /api/warmup", False, f"Exception: {e}")


def test_3_password_login():
    global LOGIN_USER_ID
    LOGIN_USER_ID = None
    try:
        r = requests.post(f"{BASE_URL}/auth/password-login",
                          json={"email": "test@mak.com", "password": "test123456"}, timeout=15)
        if r.status_code != 200:
            report("3. POST /api/auth/password-login", False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        j = r.json()
        created_at = j.get("created_at", "")
        tz_ok = "+00:00" in created_at
        LOGIN_USER_ID = j.get("id")
        report("3. POST /api/auth/password-login", tz_ok,
               f"user_id={LOGIN_USER_ID}, created_at={created_at}, tz_ok={tz_ok}")
    except Exception as e:
        report("3. POST /api/auth/password-login", False, f"Exception: {e}")


def test_4_analyze_skin():
    if not LOGIN_USER_ID:
        report("4. POST /api/analyze-skin", False, "No login user_id from previous test")
        return
    try:
        # Download and encode the test image
        img_r = requests.get(TEST_PHOTO_URL, timeout=20)
        if img_r.status_code != 200:
            report("4. POST /api/analyze-skin", False, f"Could not download test image: HTTP {img_r.status_code}")
            return
        img_b64 = base64.b64encode(img_r.content).decode("utf-8")
        print(f"   [info] downloaded test image, base64 len={len(img_b64)}")

        t0 = time.time()
        r = requests.post(f"{BASE_URL}/analyze-skin",
                          json={"user_id": LOGIN_USER_ID, "image_base64": img_b64, "mode": "skin_care"},
                          timeout=60)
        elapsed = time.time() - t0
        if r.status_code != 200:
            report("4. POST /api/analyze-skin", False, f"HTTP {r.status_code} in {elapsed:.2f}s: {r.text[:200]}")
            return
        j = r.json()
        created_at = j.get("created_at", "")
        report("4. POST /api/analyze-skin", True,
               f"200 OK in {elapsed:.2f}s ({'CACHE HIT' if elapsed<2 else 'fresh/cached'}), skin_type={j.get('skin_type')}, skin_tone={j.get('skin_tone')}, created_at={created_at}")
    except Exception as e:
        report("4. POST /api/analyze-skin", False, f"Exception: {e}")


def test_5_notify_signup():
    try:
        new_email = f"smoke_ios_{int(time.time())}@example.com"
        r = requests.post(f"{BASE_URL}/notify-signup", json={"email": new_email}, timeout=15)
        if r.status_code != 200:
            report("5. POST /api/notify-signup", False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        j = r.json()
        report("5. POST /api/notify-signup", True, f"email={new_email}, response={j}")
    except Exception as e:
        report("5. POST /api/notify-signup", False, f"Exception: {e}")


def test_6_countries():
    try:
        r = requests.get(f"{BASE_URL}/locations/countries", timeout=15)
        if r.status_code != 200:
            report("6. GET /api/locations/countries", False, f"HTTP {r.status_code}: {r.text[:200]}")
            return
        j = r.json()
        # Could be a list or a dict with key
        if isinstance(j, dict) and "countries" in j:
            countries = j["countries"]
        elif isinstance(j, list):
            countries = j
        else:
            countries = []
        count = len(countries)
        passed = count == 250
        report("6. GET /api/locations/countries", passed, f"count={count} (expected 250)")
    except Exception as e:
        report("6. GET /api/locations/countries", False, f"Exception: {e}")


def test_7_travel_style():
    if not LOGIN_USER_ID:
        report("7. POST /api/travel-style", False, "No login user_id")
        return
    try:
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/travel-style",
                          json={"user_id": LOGIN_USER_ID, "country": "France", "month": "June", "occasion": "Wedding"},
                          timeout=60)
        elapsed = time.time() - t0
        if r.status_code != 200:
            report("7. POST /api/travel-style", False, f"HTTP {r.status_code} in {elapsed:.2f}s: {r.text[:200]}")
            return
        j = r.json()
        has_payload = bool(j.get("destination_info") or j.get("outfit_suggestions") or j.get("makeup_look"))
        report("7. POST /api/travel-style", has_payload,
               f"200 OK in {elapsed:.2f}s, ai_status={j.get('ai_status')}, has_payload={has_payload}")
    except Exception as e:
        report("7. POST /api/travel-style", False, f"Exception: {e}")


def test_8_chat():
    if not LOGIN_USER_ID:
        report("8. POST /api/chat", False, "No login user_id")
        return
    try:
        t0 = time.time()
        r = requests.post(f"{BASE_URL}/chat",
                          json={"user_id": LOGIN_USER_ID, "message": "What's the best moisturizer for oily skin?"},
                          timeout=60)
        elapsed = time.time() - t0
        if r.status_code != 200:
            report("8. POST /api/chat", False, f"HTTP {r.status_code} in {elapsed:.2f}s: {r.text[:200]}")
            return
        j = r.json()
        resp_txt = j.get("response", "") or j.get("message", "") or ""
        no_bad = "Sorry we are experiencing" not in resp_txt and "Oops" not in resp_txt
        report("8. POST /api/chat", bool(resp_txt) and no_bad,
               f"200 OK in {elapsed:.2f}s, ai_status={j.get('ai_status')}, response_len={len(resp_txt)}, no_bad_phrases={no_bad}")
    except Exception as e:
        report("8. POST /api/chat", False, f"Exception: {e}")


if __name__ == "__main__":
    print(f"\n=== v1.0.11 Smoke Regression Against {BASE_URL} ===\n")
    test_1_health()
    test_2_warmup()
    test_3_password_login()
    test_4_analyze_skin()
    test_5_notify_signup()
    test_6_countries()
    test_7_travel_style()
    test_8_chat()

    print("\n=== SUMMARY ===")
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    print(f"{passed}/{total} passed")
    for name, p, details in results:
        if not p:
            print(f"  FAIL: {name} → {details}")
    sys.exit(0 if passed == total else 1)
