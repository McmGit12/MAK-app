"""Backend tests for MAK production hardening pass.

Focus:
 1. GET /api/warmup
 2. GET /api/health (improved)
 3. DB indexes (verified via mongosh)
 4. POST /api/travel-style (ai_status)
 5. POST /api/chat (ai_status)
 6. Regression: register, check-email, password-login, change-password,
    analyses history, feedback submission.
"""
import time
import uuid
import json
import subprocess
import requests

BASE_URL = "https://complexion-fit.preview.emergentagent.com/api"

results = []


def record(name, passed, detail=""):
    results.append((name, passed, detail))
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} :: {detail}")


def test_warmup():
    t0 = time.time()
    try:
        r = requests.get(f"{BASE_URL}/warmup", timeout=10)
        elapsed = time.time() - t0
        ok = r.status_code == 200
        j = r.json() if ok else {}
        has_fields = all(k in j for k in ("status", "timestamp", "mongodb"))
        mongo_warm = j.get("mongodb") == "warm"
        under_5s = elapsed < 5.0
        record(
            "GET /api/warmup",
            ok and has_fields and mongo_warm and under_5s,
            f"status={r.status_code}, elapsed={elapsed:.2f}s, body={j}",
        )
    except Exception as e:
        record("GET /api/warmup", False, f"Exception: {e}")


def test_health():
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        ok_200 = r.status_code == 200
        j = r.json() if ok_200 else {}
        needed = ("status", "timestamp", "mongodb", "llm_key_configured")
        has_all = all(k in j for k in needed)
        llm_configured = j.get("llm_key_configured") is True
        record(
            "GET /api/health",
            ok_200 and has_all and llm_configured,
            f"status={r.status_code}, body={j}",
        )
    except Exception as e:
        record("GET /api/health", False, f"Exception: {e}")


def test_travel_style():
    payload = {"country": "Japan", "month": "March", "occasion": "Vacation"}
    try:
        r = requests.post(f"{BASE_URL}/travel-style", json=payload, timeout=120)
        ok = r.status_code == 200
        j = r.json() if ok else {}
        ai_status = j.get("ai_status")
        valid_status = ai_status in ("ok", "retried", "fallback")
        has_core = "outfit_suggestions" in j and "makeup_look" in j
        fallback_ok = True
        if ai_status == "fallback":
            fallback_ok = "fallback_message" in j
        record(
            "POST /api/travel-style",
            ok and valid_status and has_core and fallback_ok,
            f"status={r.status_code}, ai_status={ai_status}, keys={list(j.keys())[:12]}",
        )
    except Exception as e:
        record("POST /api/travel-style", False, f"Exception: {e}")


def test_chat():
    try:
        r = requests.post(
            f"{BASE_URL}/chat",
            json={"message": "What foundation suits oily skin?"},
            timeout=60,
        )
        ok = r.status_code == 200
        j = r.json() if ok else {}
        ai_status = j.get("ai_status")
        valid_status = ai_status in ("ok", "retried", "fallback")
        has_resp = isinstance(j.get("response"), str) and len(j.get("response", "")) > 0
        record(
            "POST /api/chat",
            ok and valid_status and has_resp,
            f"status={r.status_code}, ai_status={ai_status}, resp_len={len(j.get('response',''))}",
        )
    except Exception as e:
        record("POST /api/chat", False, f"Exception: {e}")


def test_regression_auth_flow():
    unique_id = uuid.uuid4().hex[:8]
    email = f"priya.sharma.{unique_id}@makbeauty.com"
    password = "SecurePass2026!"
    new_password = "EvenStronger2026!"

    user_id = None
    try:
        r = requests.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": email,
                "name": "Priya Sharma",
                "password": password,
                "phone": "9876543210",
                "country_code": "+91",
            },
            timeout=15,
        )
        ok = r.status_code == 200
        j = r.json() if ok else {}
        user_id = j.get("id")
        record(
            "REG: POST /api/auth/register",
            ok and bool(user_id) and j.get("email") == email,
            f"status={r.status_code}, id={user_id}",
        )
    except Exception as e:
        record("REG: POST /api/auth/register", False, f"Exception: {e}")
        return

    try:
        r = requests.post(
            f"{BASE_URL}/auth/check-email", json={"email": email}, timeout=10
        )
        ok = r.status_code == 200 and r.json().get("exists") is True
        record(
            "REG: POST /api/auth/check-email (exists)",
            ok,
            f"status={r.status_code}, body={r.json()}",
        )
    except Exception as e:
        record("REG: POST /api/auth/check-email (exists)", False, f"Exception: {e}")

    try:
        r = requests.post(
            f"{BASE_URL}/auth/check-email",
            json={"email": f"nope.{unique_id}@makbeauty.com"},
            timeout=10,
        )
        ok = r.status_code == 200 and r.json().get("exists") is False
        record("REG: POST /api/auth/check-email (new)", ok, f"body={r.json()}")
    except Exception as e:
        record("REG: POST /api/auth/check-email (new)", False, f"Exception: {e}")

    try:
        r = requests.post(
            f"{BASE_URL}/auth/password-login",
            json={"email": email, "password": password},
            timeout=10,
        )
        ok = r.status_code == 200 and r.json().get("id") == user_id
        record(
            "REG: POST /api/auth/password-login (correct)",
            ok,
            f"status={r.status_code}",
        )
    except Exception as e:
        record("REG: POST /api/auth/password-login (correct)", False, f"Exception: {e}")

    try:
        r = requests.post(
            f"{BASE_URL}/auth/password-login",
            json={"email": email, "password": "WRONG"},
            timeout=10,
        )
        record(
            "REG: POST /api/auth/password-login (wrong)",
            r.status_code == 400,
            f"status={r.status_code}",
        )
    except Exception as e:
        record("REG: POST /api/auth/password-login (wrong)", False, f"Exception: {e}")

    try:
        r = requests.post(
            f"{BASE_URL}/auth/change-password",
            json={
                "user_id": user_id,
                "current_password": password,
                "new_password": new_password,
            },
            timeout=10,
        )
        record(
            "REG: POST /api/auth/change-password",
            r.status_code == 200,
            f"status={r.status_code}, body={r.text[:100]}",
        )
    except Exception as e:
        record("REG: POST /api/auth/change-password", False, f"Exception: {e}")

    try:
        r = requests.post(
            f"{BASE_URL}/auth/password-login",
            json={"email": email, "password": new_password},
            timeout=10,
        )
        record(
            "REG: password-login with NEW password",
            r.status_code == 200,
            f"status={r.status_code}",
        )
    except Exception as e:
        record("REG: password-login with NEW password", False, f"Exception: {e}")

    try:
        r = requests.get(f"{BASE_URL}/analyses/{user_id}", timeout=10)
        ok = r.status_code == 200 and isinstance(r.json(), list)
        record(
            "REG: GET /api/analyses/{user_id}",
            ok,
            f"status={r.status_code}, count={len(r.json()) if ok else 'n/a'}",
        )
    except Exception as e:
        record("REG: GET /api/analyses/{user_id}", False, f"Exception: {e}")

    try:
        r = requests.post(
            f"{BASE_URL}/feedback",
            json={
                "user_id": user_id,
                "rating": 5,
                "category": "app_experience",
                "comment": "Loving the travel style feature!",
            },
            timeout=10,
        )
        j = r.json() if r.status_code == 200 else {}
        ok = (
            r.status_code == 200
            and j.get("user_id") == user_id
            and j.get("rating") == 5
        )
        record(
            "REG: POST /api/feedback",
            ok,
            f"status={r.status_code}, id={j.get('id')}",
        )
    except Exception as e:
        record("REG: POST /api/feedback", False, f"Exception: {e}")


def test_indexes_via_mongo():
    try:
        out = subprocess.check_output(
            [
                "mongosh",
                "complexionfit_db",
                "--quiet",
                "--eval",
                "print(JSON.stringify({"
                "users: db.users.getIndexes().map(i=>i.name),"
                "analyses: db.analyses.getIndexes().map(i=>i.name),"
                "app_installs: db.app_installs.getIndexes().map(i=>i.name),"
                "feedback: db.feedback.getIndexes().map(i=>i.name)"
                "}))",
            ],
            timeout=10,
            text=True,
        )
        data = json.loads(out.strip())
        ok = (
            "user_hash_1" in data["users"]
            and "id_1" in data["users"]
            and "user_id_1_created_at_-1" in data["analyses"]
            and "id_1" in data["analyses"]
            and "device_id_1" in data["app_installs"]
            and "user_id_1_created_at_-1" in data["feedback"]
        )
        record("Startup: MongoDB indexes created", ok, f"indexes={data}")
    except Exception as e:
        record("Startup: MongoDB indexes created", False, f"Exception: {e}")


if __name__ == "__main__":
    print(f"Testing backend at: {BASE_URL}\n")
    test_warmup()
    test_health()
    test_indexes_via_mongo()
    test_travel_style()
    test_chat()
    test_regression_auth_flow()

    print("\n" + "=" * 60)
    passed = sum(1 for _, p, _ in results if p)
    failed = sum(1 for _, p, _ in results if not p)
    print(f"TOTAL: {passed} passed, {failed} failed out of {len(results)}")
    if failed:
        print("\nFAILED TESTS:")
        for n, p, d in results:
            if not p:
                print(f"  - {n}: {d}")
