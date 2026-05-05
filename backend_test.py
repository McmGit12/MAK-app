"""
Backend API pre-deployment verification for MAK app.
Tests error-handling changes + regression coverage per review request.
"""
import requests
import time
import json
import sys

BASE_URL = "https://makeup-buddy-preview.preview.emergentagent.com/api"
GENERIC_ERR = "Sorry we are experiencing issues, please try again in some time."

results = []

def record(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} — {detail}")
    results.append((name, passed, detail))

def post(path, payload, timeout=60):
    return requests.post(BASE_URL + path, json=payload, timeout=timeout)

def get(path, timeout=30):
    return requests.get(BASE_URL + path, timeout=timeout)


# ==================== REGRESSION CHECKS ====================

def test_warmup():
    t0 = time.time()
    try:
        r = get("/warmup", timeout=15)
        elapsed = time.time() - t0
        ok = r.status_code == 200 and elapsed < 5
        record("GET /api/warmup", ok, f"status={r.status_code} elapsed={elapsed:.2f}s body={r.json()}")
    except Exception as e:
        record("GET /api/warmup", False, f"exception: {e}")

def test_health():
    try:
        r = get("/health", timeout=15)
        body = r.json()
        ok = (r.status_code == 200 and "status" in body and "mongodb" in body and "llm_key_configured" in body)
        record("GET /api/health", ok, f"status={r.status_code} body={body}")
    except Exception as e:
        record("GET /api/health", False, f"exception: {e}")

def test_seeded_login():
    try:
        r = post("/auth/password-login", {"email": "test@mak.com", "password": "test123456"})
        ok = r.status_code == 200 and "id" in r.json()
        if ok:
            record("Seeded login test@mak.com/test123456", True, f"user_id={r.json()['id']}")
            return r.json()["id"]
        record("Seeded login test@mak.com/test123456", False, f"status={r.status_code} body={r.text[:200]}")
        return None
    except Exception as e:
        record("Seeded login test@mak.com/test123456", False, f"exception: {e}")
        return None

def test_auth_flow():
    ts = int(time.time())
    email = f"test_new_{ts}@mak.com"
    password = "Secure123!"
    new_password = "NewSecure456!"
    name = "Maya Sharma"
    user_id = None

    try:
        r = post("/auth/check-email", {"email": email})
        ok = r.status_code == 200 and r.json().get("exists") is False
        record("check-email new user", ok, f"status={r.status_code} body={r.json()}")
    except Exception as e:
        record("check-email new user", False, f"exception: {e}")

    try:
        r = post("/auth/register", {"email": email, "name": name, "password": password})
        ok = r.status_code == 200 and "id" in r.json()
        if ok:
            user_id = r.json()["id"]
        record("register new user", ok, f"status={r.status_code} user_id={user_id}")
    except Exception as e:
        record("register new user", False, f"exception: {e}")

    try:
        r = post("/auth/check-email", {"email": email})
        ok = r.status_code == 200 and r.json().get("exists") is True
        record("check-email existing user", ok, f"status={r.status_code} body={r.json()}")
    except Exception as e:
        record("check-email existing user", False, f"exception: {e}")

    try:
        r = post("/auth/password-login", {"email": email, "password": password})
        ok = r.status_code == 200 and r.json().get("id") == user_id
        record("password-login correct", ok, f"status={r.status_code}")
    except Exception as e:
        record("password-login correct", False, f"exception: {e}")

    try:
        r = post("/auth/password-login", {"email": email, "password": "wrong-password"})
        ok = r.status_code == 400
        record("password-login wrong password returns 400", ok, f"status={r.status_code}")
    except Exception as e:
        record("password-login wrong password returns 400", False, f"exception: {e}")

    if user_id:
        try:
            r = post("/auth/change-password", {"user_id": user_id, "current_password": password, "new_password": new_password})
            ok = r.status_code == 200
            record("change-password success", ok, f"status={r.status_code}")
        except Exception as e:
            record("change-password success", False, f"exception: {e}")

        try:
            r = post("/auth/password-login", {"email": email, "password": new_password})
            ok = r.status_code == 200
            record("login with new password", ok, f"status={r.status_code}")
        except Exception as e:
            record("login with new password", False, f"exception: {e}")

    return user_id


# ==================== REVIEW REQUEST FOCUS ====================

def test_travel_style_happy():
    try:
        r = post("/travel-style", {"country": "France", "month": "June", "occasion": "Vacation"}, timeout=90)
        if r.status_code != 200:
            record("travel-style happy path (France/June/Vacation)", False, f"status={r.status_code} body={r.text[:300]}")
            return
        body = r.json()
        required = ["destination_info", "outfit_suggestions", "makeup_look", "accessories", "dos_and_donts", "overall_vibe", "ai_status"]
        missing = [k for k in required if k not in body]
        has_fallback_msg = "fallback_message" in body
        ai_status = body.get("ai_status")
        ok = (not missing) and ai_status == "ok" and not has_fallback_msg
        detail = f"ai_status={ai_status} missing={missing} has_fallback_message={has_fallback_msg}"
        record("travel-style happy path (ai_status=ok, no fallback_message)", ok, detail)
    except Exception as e:
        record("travel-style happy path", False, f"exception: {e}")

def test_chat_happy():
    try:
        r = post("/chat", {"message": "What's a simple morning skincare routine for oily skin?"}, timeout=90)
        if r.status_code != 200:
            record("chat happy path", False, f"status={r.status_code} body={r.text[:200]}")
            return
        body = r.json()
        ai_status = body.get("ai_status")
        resp = body.get("response", "")
        ok = ai_status == "ok" and isinstance(resp, str) and len(resp) > 10
        record("chat happy path (ai_status=ok)", ok, f"ai_status={ai_status} resp_len={len(resp)}")
    except Exception as e:
        record("chat happy path", False, f"exception: {e}")

def test_analyze_skin_error_generic(user_id):
    if not user_id:
        record("analyze-skin error path", False, "no user_id available")
        return

    tiny_png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABCAEAsRMeMgAAAABJRU5ErkJggg=="
    try:
        r = post("/analyze-skin", {"image_base64": tiny_png_b64, "user_id": user_id, "mode": "skin_care"}, timeout=180)
        if r.status_code == 503:
            body = r.json()
            detail = body.get("detail", "")
            ok = detail == GENERIC_ERR
            record("analyze-skin 503 with exact generic detail on failure", ok, f"detail={detail!r}")
        elif r.status_code == 200:
            record("analyze-skin endpoint (1x1 image happy)", True, f"status=200, endpoint working (no failure triggered)")
        else:
            record("analyze-skin error path", False, f"unexpected status={r.status_code} body={r.text[:300]}")
    except requests.Timeout:
        record("analyze-skin error path", False, "request timed out — LLM hanging")
    except Exception as e:
        record("analyze-skin error path", False, f"exception: {e}")


def test_analyses_list(user_id):
    if not user_id:
        record("GET /api/analyses/{user_id}", False, "no user_id")
        return
    try:
        r = get(f"/analyses/{user_id}")
        ok = r.status_code == 200 and isinstance(r.json(), list)
        record("GET /api/analyses/{user_id}", ok, f"status={r.status_code} count={len(r.json()) if r.status_code == 200 else 'N/A'}")
    except Exception as e:
        record("GET /api/analyses/{user_id}", False, f"exception: {e}")

def test_feedback(user_id):
    if not user_id:
        record("POST /api/feedback", False, "no user_id")
        return
    try:
        r = post("/feedback", {"user_id": user_id, "rating": 5, "category": "app_experience", "comment": "Great experience with MAK!"})
        ok = r.status_code == 200 and "id" in r.json()
        record("POST /api/feedback", ok, f"status={r.status_code}")
    except Exception as e:
        record("POST /api/feedback", False, f"exception: {e}")


if __name__ == "__main__":
    print(f"Testing backend at: {BASE_URL}\n")
    print("=" * 70)

    test_warmup()
    test_health()
    seeded_uid = test_seeded_login()
    new_uid = test_auth_flow()

    test_travel_style_happy()
    test_chat_happy()
    test_analyze_skin_error_generic(seeded_uid or new_uid)

    test_analyses_list(seeded_uid or new_uid)
    test_feedback(seeded_uid or new_uid)

    print("\n" + "=" * 70)
    passed = sum(1 for _, p, _ in results if p)
    failed = [(n, d) for n, p, d in results if not p]
    print(f"RESULTS: {passed}/{len(results)} passed")
    if failed:
        print("\nFAILED TESTS:")
        for name, detail in failed:
            print(f"  - {name}: {detail}")
        sys.exit(1)
    sys.exit(0)
