"""
v1.0.1 Backend Tests for MAK app — Error UX overhaul + resilience.
Focus: error-handling improvements per review request.
"""
import os
import sys
import time
import json
import requests
from typing import Tuple

BASE_URL = "https://mak-makeup-buddy.preview.emergentagent.com/api"
OLD_ERR = "Sorry we are experiencing issues, please try again in some time."

results = []


def log(name: str, ok: bool, details: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {details}")
    results.append({"name": name, "ok": ok, "details": details})


def post(path: str, payload: dict, timeout: int = 60) -> Tuple[int, dict, float]:
    t0 = time.time()
    try:
        r = requests.post(f"{BASE_URL}{path}", json=payload, timeout=timeout)
        elapsed = time.time() - t0
        try:
            data = r.json()
        except Exception:
            data = {"_raw": r.text}
        return r.status_code, data, elapsed
    except requests.exceptions.RequestException as e:
        elapsed = time.time() - t0
        return -1, {"_error": str(e)}, elapsed


def get(path: str, timeout: int = 30) -> Tuple[int, dict, float]:
    t0 = time.time()
    try:
        r = requests.get(f"{BASE_URL}{path}", timeout=timeout)
        elapsed = time.time() - t0
        try:
            data = r.json()
        except Exception:
            data = {"_raw": r.text}
        return r.status_code, data, elapsed
    except requests.exceptions.RequestException as e:
        elapsed = time.time() - t0
        return -1, {"_error": str(e)}, elapsed


def get_test_user_id():
    code, data, _ = post("/auth/password-login", {
        "email": "test@mak.com",
        "password": "test123456"
    })
    if code == 200:
        return data.get("id")
    code, data, _ = post("/auth/register", {
        "email": "test@mak.com",
        "name": "Test User",
        "password": "test123456"
    })
    if code == 200:
        return data.get("id")
    return None


def assert_no_old_string(data: dict, name: str):
    raw = json.dumps(data)
    if OLD_ERR in raw:
        log(f"{name} :: no-old-string", False, f"FOUND OLD STRING in response: {raw[:200]}")
        return False
    return True


# ============================================================
# PRIORITY TESTS
# ============================================================

def test_warmup():
    code, data, elapsed = get("/warmup", timeout=10)
    ok = code == 200 and elapsed < 5.0
    log("GET /api/warmup", ok,
        f"status={code}, elapsed={elapsed:.2f}s, body={data}")
    return ok


def test_health():
    code, data, _ = get("/health", timeout=10)
    has_mongo = "mongodb" in data
    has_llm = "llm_key_configured" in data
    ok = code == 200 and has_mongo and has_llm
    log("GET /api/health", ok,
        f"status={code}, mongodb={data.get('mongodb')}, llm_key_configured={data.get('llm_key_configured')}")
    return ok


def test_analyze_skin_empty():
    code, data, elapsed = post("/analyze-skin", {
        "user_id": "test-user",
        "image_base64": "",
        "mode": "skin_care"
    }, timeout=15)
    detail = data.get("detail", "")
    expected = "Image couldn't be processed"
    ok = code == 400 and expected in detail
    log("POST /api/analyze-skin (empty image)", ok,
        f"status={code}, detail={detail!r}, elapsed={elapsed:.2f}s")
    assert_no_old_string(data, "analyze-skin empty")
    return ok


def test_analyze_skin_too_short():
    code, data, elapsed = post("/analyze-skin", {
        "user_id": "test-user",
        "image_base64": "abc",
        "mode": "skin_care"
    }, timeout=15)
    detail = data.get("detail", "")
    ok = code == 400 and "Image" in detail
    log("POST /api/analyze-skin (too short < 200 chars)", ok,
        f"status={code}, detail={detail!r}, elapsed={elapsed:.2f}s")
    assert_no_old_string(data, "analyze-skin too-short")
    return ok


def test_analyze_skin_too_large():
    huge = "A" * 15_000_001
    code, data, elapsed = post("/analyze-skin", {
        "user_id": "test-user",
        "image_base64": huge,
        "mode": "skin_care"
    }, timeout=120)
    detail = data.get("detail", "")
    expected = "Image is too large"
    ok = code == 400 and expected in detail
    log("POST /api/analyze-skin (>15M chars)", ok,
        f"status={code}, detail={detail!r}, elapsed={elapsed:.2f}s")
    assert_no_old_string(data, "analyze-skin too-large")
    return ok


def test_analyze_skin_valid_small(user_id: str):
    tiny_png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
        "+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )
    img = tiny_png_b64 * 5  # ~520 chars to bypass length check
    code, data, elapsed = post("/analyze-skin", {
        "user_id": user_id,
        "image_base64": img,
        "mode": "skin_care"
    }, timeout=60)
    ok_status = code in (200, 503)
    ok_time = elapsed < 50.0
    detail = data.get("detail", "")
    no_old = OLD_ERR not in json.dumps(data)
    if code == 503:
        good_msg = "Service is busy" in detail
    else:
        good_msg = True
    ok = ok_status and ok_time and no_old and good_msg
    log("POST /api/analyze-skin (valid 1x1 PNG)", ok,
        f"status={code}, elapsed={elapsed:.2f}s, detail={detail[:120]!r}, no_old_str={no_old}")
    return ok


def test_travel_style_happy_path():
    code, data, elapsed = post("/travel-style", {
        "country": "USA",
        "month": "March",
        "occasion": "Wedding"
    }, timeout=60)
    no_old = OLD_ERR not in json.dumps(data)
    if code == 200:
        has_ai_status = "ai_status" in data
        ok = has_ai_status and no_old
        log("POST /api/travel-style (USA/March/Wedding)", ok,
            f"status=200, ai_status={data.get('ai_status')}, has_destination_info={'destination_info' in data}, elapsed={elapsed:.2f}s")
    elif code == 503:
        detail = data.get("detail", "")
        ok = "Service is busy" in detail and no_old
        log("POST /api/travel-style (USA/March/Wedding) — 503 fallback", ok,
            f"status=503, detail={detail!r}, elapsed={elapsed:.2f}s")
    else:
        ok = False
        log("POST /api/travel-style (USA/March/Wedding)", ok,
            f"unexpected status={code}, body={str(data)[:200]}, elapsed={elapsed:.2f}s")
    return ok


def test_chat_happy_path():
    code, data, elapsed = post("/chat", {
        "message": "What's the best moisturizer for oily skin?"
    }, timeout=60)
    no_old = OLD_ERR not in json.dumps(data)
    if code == 200:
        resp_text = data.get("response", "")
        if data.get("ai_status") == "fallback":
            new_fallback = "having a little trouble" in resp_text
            ok = new_fallback and no_old
            log("POST /api/chat (fallback)", ok,
                f"ai_status=fallback, response={resp_text[:120]!r}, elapsed={elapsed:.2f}s")
        else:
            ok = bool(resp_text) and no_old
            log("POST /api/chat (happy path)", ok,
                f"status=200, ai_status={data.get('ai_status')}, response_len={len(resp_text)}, elapsed={elapsed:.2f}s")
    else:
        ok = False
        log("POST /api/chat (happy path)", ok,
            f"unexpected status={code}, body={str(data)[:200]}")
    return ok


# ============================================================
# REGRESSION TESTS
# ============================================================

def test_check_email():
    code, data, _ = post("/auth/check-email", {"email": "test@mak.com"})
    ok = code == 200 and data.get("exists") is True
    log("POST /api/auth/check-email (test@mak.com)", ok,
        f"status={code}, exists={data.get('exists')}")
    return ok


def test_password_login(user_id_holder: list):
    code, data, _ = post("/auth/password-login", {
        "email": "test@mak.com",
        "password": "test123456"
    })
    ok = code == 200 and "id" in data and data.get("email") == "test@mak.com"
    if ok:
        user_id_holder.append(data["id"])
    uid = data.get('id', 'N/A')
    if isinstance(uid, str) and len(uid) > 8:
        uid = uid[:8] + "..."
    log("POST /api/auth/password-login", ok,
        f"status={code}, user_id={uid}, email={data.get('email')}")
    return ok


def test_get_analyses(user_id: str):
    code, data, _ = get(f"/analyses/{user_id}")
    ok = code == 200 and isinstance(data, list)
    log("GET /api/analyses/{user_id}", ok,
        f"status={code}, count={len(data) if isinstance(data, list) else 'N/A'}")
    return ok


def main():
    print(f"\n{'='*60}\nv1.0.1 Backend Tests — MAK App\n{'='*60}\nBase URL: {BASE_URL}\n")

    user_id = get_test_user_id()
    if not user_id:
        print("FATAL: cannot establish test user (login/register both failed)")
        sys.exit(1)
    print(f"Test user_id: {user_id}\n")
    print("--- PRIORITY TESTS ---\n")
    test_warmup()
    test_health()
    test_analyze_skin_empty()
    test_analyze_skin_too_short()
    test_analyze_skin_too_large()
    test_analyze_skin_valid_small(user_id)
    test_travel_style_happy_path()
    test_chat_happy_path()

    print("\n--- REGRESSION TESTS ---\n")
    test_check_email()
    holder = []
    test_password_login(holder)
    uid = holder[0] if holder else user_id
    test_get_analyses(uid)

    print(f"\n{'='*60}\nSUMMARY\n{'='*60}")
    passed = sum(1 for r in results if r["ok"])
    total = len(results)
    print(f"PASSED: {passed}/{total}\n")
    for r in results:
        mark = "PASS" if r["ok"] else "FAIL"
        print(f"  [{mark}] {r['name']}")
    if passed != total:
        print(f"\nFAILED tests:")
        for r in results:
            if not r["ok"]:
                print(f"  - {r['name']}: {r['details']}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
