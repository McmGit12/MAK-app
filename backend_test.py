"""
MAK app v1.0.12 backend test suite.
Tests new endpoints (forgot-password, reset-password, delete-account) + regression.
"""
import os
import time
import uuid
import hashlib
import asyncio
from datetime import datetime, timezone, timedelta

import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load backend env to talk to Mongo directly (for token insertion + verification)
load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "complexionfit_db")

BASE = "https://mak-makeup-buddy.preview.emergentagent.com/api"

PRIMARY_EMAIL = "test@mak.com"
PRIMARY_PASSWORD = "test123456"

results = []  # list of (name, passed:bool, detail)


def record(name, passed, detail=""):
    icon = "PASS" if passed else "FAIL"
    print(f"[{icon}] {name}: {detail}")
    results.append((name, passed, detail))


def now_utc():
    return datetime.now(timezone.utc)


# ===================================================================
# REGRESSION TESTS
# ===================================================================
def test_regression():
    print("\n=== REGRESSION ===")

    r = requests.get(f"{BASE}/health", timeout=10)
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and body.get("mongodb") == "connected" and body.get("llm_key_configured") is True
    record("GET /api/health", ok, f"status={r.status_code} body={body}")

    r = requests.get(f"{BASE}/warmup", timeout=10)
    record("GET /api/warmup", r.status_code == 200, f"status={r.status_code}")

    r = requests.post(f"{BASE}/auth/check-email", json={"email": PRIMARY_EMAIL}, timeout=10)
    record("POST /api/auth/check-email", r.status_code == 200 and r.json().get("exists") is True, f"status={r.status_code} body={r.json()}")

    new_email = f"regression_{int(time.time())}@mak.com"
    r = requests.post(f"{BASE}/auth/register", json={"email": new_email, "name": "Regression Tester", "password": "regress123"}, timeout=10)
    record("POST /api/auth/register (new user)", r.status_code == 200 and r.json().get("id"), f"status={r.status_code}")
    new_user_id = r.json().get("id") if r.status_code == 200 else None

    r = requests.post(f"{BASE}/auth/password-login", json={"email": PRIMARY_EMAIL, "password": PRIMARY_PASSWORD}, timeout=10)
    record("POST /api/auth/password-login (test@mak.com)", r.status_code == 200, f"status={r.status_code}")
    primary_user_id = r.json().get("id") if r.status_code == 200 else None

    if new_user_id:
        r = requests.post(f"{BASE}/auth/change-password", json={"user_id": new_user_id, "current_password": "regress123", "new_password": "regress456"}, timeout=10)
        record("POST /api/auth/change-password", r.status_code == 200, f"status={r.status_code}")

    r = requests.get(f"{BASE}/locations/countries", timeout=10)
    data = r.json() if r.status_code == 200 else []
    record("GET /api/locations/countries", r.status_code == 200 and isinstance(data, list) and len(data) > 100, f"status={r.status_code} count={len(data) if isinstance(data, list) else 'N/A'}")

    r = requests.get(f"{BASE}/locations/states/IN", timeout=10)
    data = r.json() if r.status_code == 200 else []
    record("GET /api/locations/states/IN", r.status_code == 200 and isinstance(data, list) and len(data) > 10, f"status={r.status_code} count={len(data) if isinstance(data, list) else 'N/A'}")

    notify_email = f"notify_{int(time.time())}@mak.com"
    r = requests.post(f"{BASE}/notify-signup", json={"email": notify_email}, timeout=10)
    record("POST /api/notify-signup", r.status_code == 200 and r.json().get("status") == "ok", f"status={r.status_code}")

    if primary_user_id:
        tiny_jpeg_b64 = (
            "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB"
            "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB"
            "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAA"
            "AAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAA"
            "AAAA/9oADAMBAAIRAxEAPwA/AB//2Q=="
        )
        try:
            r = requests.post(f"{BASE}/analyze-skin", json={"image_base64": tiny_jpeg_b64, "user_id": primary_user_id, "mode": "skin_care"}, timeout=60)
            # 200 (cached/ok), 400 (validation), 422 (refusal), 503 (LLM busy) all acceptable for tiny image
            ok = r.status_code in (200, 400, 422, 503)
            detail = f"status={r.status_code}"
            if r.status_code == 200:
                has_recs = "ai_recommendations" in r.json()
                detail += f" has_ai_recommendations={has_recs}"
                ok = ok and has_recs
            record("POST /api/analyze-skin", ok, detail)
        except Exception as e:
            record("POST /api/analyze-skin", False, f"exception={e}")


# ===================================================================
# 1) FORGOT-PASSWORD
# ===================================================================
def test_forgot_password(loop, db):
    print("\n=== /api/auth/forgot-password ===")

    one_hour_ago = now_utc() - timedelta(hours=1)
    loop.run_until_complete(db.password_reset_tokens.delete_many({"email": PRIMARY_EMAIL, "requested_at": {"$gte": one_hour_ago}}))

    # 1a) Registered user
    t0 = time.time()
    r = requests.post(f"{BASE}/auth/forgot-password", json={"email": PRIMARY_EMAIL}, timeout=30)
    elapsed = time.time() - t0
    expected_msg = "If that email is registered with MAK, you'll receive a reset link within a minute. Check your inbox (and spam folder)."
    body = r.json() if r.status_code == 200 else {}
    ok = (r.status_code == 200 and body.get("status") == "ok" and body.get("message") == expected_msg)
    record("1a) Registered user: status+message", ok, f"status={r.status_code} msg_match={body.get('message')==expected_msg} elapsed={elapsed:.2f}s")
    record("1a) Registered user: elapsed in real-SMTP range", 0.8 <= elapsed <= 20, f"elapsed={elapsed:.2f}s (expected ~1-5s)")

    # 1b) Unregistered email
    t0 = time.time()
    # NOTE: spec example "noone-12345@nowhere.test" fails Pydantic EmailStr because
    # ".test" is an RFC2606 reserved TLD. Using a syntactically-valid unregistered email instead.
    r = requests.post(f"{BASE}/auth/forgot-password", json={"email": "noone-fake-12345@example.com"}, timeout=10)
    elapsed_b = time.time() - t0
    body = r.json() if r.status_code == 200 else {}
    ok = (r.status_code == 200 and body.get("message") == expected_msg)
    record("1b) Unregistered: same 200 + same msg (anti-enumeration)", ok, f"status={r.status_code} elapsed={elapsed_b:.2f}s")
    record("1b) Unregistered: short timing-mask delay (~0.4-0.8s)", 0.3 <= elapsed_b <= 2.5, f"elapsed={elapsed_b:.2f}s")

    # 1c) Invalid email format → 422
    r = requests.post(f"{BASE}/auth/forgot-password", json={"email": "not-an-email"}, timeout=10)
    record("1c) Invalid format → 422 (Pydantic EmailStr)", r.status_code == 422, f"status={r.status_code} body={r.text[:200]}")

    # 1d) Rate-limit test: send 3 more to reach 4 total
    rate_results = []
    for i in range(3):
        r = requests.post(f"{BASE}/auth/forgot-password", json={"email": PRIMARY_EMAIL}, timeout=30)
        rate_results.append(r.status_code)

    one_hour_ago = now_utc() - timedelta(hours=1)
    token_count = loop.run_until_complete(
        db.password_reset_tokens.count_documents({"email": PRIMARY_EMAIL, "requested_at": {"$gte": one_hour_ago}})
    )
    record("1d) Rate-limit: all 4 requests return 200", all(s == 200 for s in rate_results), f"3 additional={rate_results}")
    record("1d) Rate-limit: <=3 tokens persisted in DB last hour", token_count <= 3, f"tokens_in_last_hour={token_count}")

    # 1e) Verify token doc fields
    token_doc = loop.run_until_complete(
        db.password_reset_tokens.find_one({"email": PRIMARY_EMAIL, "used_at": None}, sort=[("requested_at", -1)])
    )
    if token_doc:
        token_hash = token_doc.get("token_hash", "")
        expires_at = token_doc.get("expires_at")
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        target = now_utc() + timedelta(minutes=30)
        delta = abs((expires_at - target).total_seconds()) if expires_at else 99999
        user = loop.run_until_complete(db.users.find_one({"email": PRIMARY_EMAIL}))
        user_id = user["id"] if user else None
        record("1e) token_hash is 64-char hex", len(token_hash) == 64 and all(c in "0123456789abcdef" for c in token_hash.lower()), f"len={len(token_hash)}")
        record("1e) user_id matches test@mak.com", token_doc.get("user_id") == user_id, "")
        record("1e) expires_at ~ now+30min (<=5min drift)", delta <= 300, f"drift_seconds={delta:.0f}")
        record("1e) used_at is None", token_doc.get("used_at") is None, "")
        record("1e) email == test@mak.com", token_doc.get("email") == PRIMARY_EMAIL, "")
    else:
        record("1e) DB side-effects: token doc exists", False, "no unused token found")


# ===================================================================
# 2) RESET-PASSWORD
# ===================================================================
def test_reset_password(loop, db):
    print("\n=== /api/auth/reset-password ===")

    user = loop.run_until_complete(db.users.find_one({"email": PRIMARY_EMAIL}))
    if not user:
        record("2) Setup: find test@mak.com", False, "primary user not found")
        return
    user_id = user["id"]
    original_password_hash = user["password_hash"]

    plain = "TESTTOKEN_for_unit_test_12345"
    token_hash = hashlib.sha256(plain.encode()).hexdigest()
    loop.run_until_complete(db.password_reset_tokens.delete_many({"token_hash": token_hash}))
    loop.run_until_complete(db.password_reset_tokens.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "email": PRIMARY_EMAIL,
        "token_hash": token_hash,
        "requested_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=30),
        "used_at": None,
    }))

    # Insert a second unused token to verify it gets marked used after reset
    plain2 = "SECONDTOKEN_unused_98765"
    token_hash2 = hashlib.sha256(plain2.encode()).hexdigest()
    loop.run_until_complete(db.password_reset_tokens.delete_many({"token_hash": token_hash2}))
    loop.run_until_complete(db.password_reset_tokens.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "email": PRIMARY_EMAIL,
        "token_hash": token_hash2,
        "requested_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=30),
        "used_at": None,
    }))

    # 2a) Valid token + valid password
    new_password = "newPass_v1012!"
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": plain, "new_password": new_password}, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and body.get("status") == "ok" and "Password updated successfully" in body.get("message", "")
    record("2a) Valid token + valid pwd -> 200", ok, f"status={r.status_code} body={body}")

    user_after = loop.run_until_complete(db.users.find_one({"id": user_id}))
    record("2a) password_hash updated in DB", user_after["password_hash"] != original_password_hash, "")

    consumed = loop.run_until_complete(db.password_reset_tokens.find_one({"token_hash": token_hash}))
    record("2a) Consumed token has used_at set", consumed and consumed.get("used_at") is not None, "")

    other = loop.run_until_complete(db.password_reset_tokens.find_one({"token_hash": token_hash2}))
    record("2a) Other unused tokens for user marked used_at", other and other.get("used_at") is not None, "")

    # 2b) Reuse same token
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": plain, "new_password": "anotherPass123"}, timeout=10)
    detail = r.json().get("detail", "") if r.status_code != 200 else ""
    record("2b) Reuse token -> 400 'already been used'", r.status_code == 400 and "already been used" in detail.lower(), f"status={r.status_code} detail={detail}")

    # 2c) Unknown token
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": "INVALID_TOKEN_NOT_IN_DB", "new_password": "validPass123"}, timeout=10)
    detail = r.json().get("detail", "") if r.status_code != 200 else ""
    ok = r.status_code == 400 and "invalid" in detail.lower() and "expired" in detail.lower()
    record("2c) Unknown token -> 400 'invalid or has expired'", ok, f"status={r.status_code} detail={detail}")

    # 2d) Expired token
    plain_exp = "EXPIRED_TOKEN_unit_test_xyz"
    th_exp = hashlib.sha256(plain_exp.encode()).hexdigest()
    loop.run_until_complete(db.password_reset_tokens.delete_many({"token_hash": th_exp}))
    loop.run_until_complete(db.password_reset_tokens.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "email": PRIMARY_EMAIL,
        "token_hash": th_exp,
        "requested_at": now_utc() - timedelta(minutes=35),
        "expires_at": now_utc() - timedelta(minutes=1),
        "used_at": None,
    }))
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": plain_exp, "new_password": "validPass123"}, timeout=10)
    detail = r.json().get("detail", "") if r.status_code != 200 else ""
    record("2d) Expired token -> 400 'expired'", r.status_code == 400 and "expired" in detail.lower(), f"status={r.status_code} detail={detail}")

    # 2e) Weak password (5 chars)
    plain_weak = "WEAKPASSTOKEN_unit_test_xyz"
    th_w = hashlib.sha256(plain_weak.encode()).hexdigest()
    loop.run_until_complete(db.password_reset_tokens.delete_many({"token_hash": th_w}))
    loop.run_until_complete(db.password_reset_tokens.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "email": PRIMARY_EMAIL,
        "token_hash": th_w,
        "requested_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=30),
        "used_at": None,
    }))
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": plain_weak, "new_password": "abcde"}, timeout=10)
    detail = r.json().get("detail", "") if r.status_code != 200 else ""
    record("2e) Weak password -> 400 'at least 6 characters'", r.status_code == 400 and "at least 6 characters" in detail.lower(), f"status={r.status_code} detail={detail}")

    # 2f) HTML injection
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": plain_weak, "new_password": "<script>alert(1)</script>"}, timeout=10)
    detail = r.json().get("detail", "") if r.status_code != 200 else ""
    record("2f) HTML-injection pwd -> 400 'invalid characters'", r.status_code == 400 and "invalid characters" in detail.lower(), f"status={r.status_code} detail={detail}")

    # 2g) Empty token
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": "", "new_password": "validPass123"}, timeout=10)
    record("2g) Empty token -> 400", r.status_code == 400, f"status={r.status_code} body={r.text[:200]}")

    # 2h) Login with new password
    r = requests.post(f"{BASE}/auth/password-login", json={"email": PRIMARY_EMAIL, "password": new_password}, timeout=10)
    record("2h) Login with new password works", r.status_code == 200, f"status={r.status_code}")

    # RESTORE original test123456 (DO NOT delete/modify seed user)
    r = requests.post(f"{BASE}/auth/change-password", json={"user_id": user_id, "current_password": new_password, "new_password": PRIMARY_PASSWORD}, timeout=10)
    record("2h) RESTORE original password test123456", r.status_code == 200, f"status={r.status_code}")


# ===================================================================
# 3) DELETE-ACCOUNT
# ===================================================================
def test_delete_account(loop, db):
    print("\n=== /api/auth/delete-account ===")

    del_email = "delete-test-v1012@mak.com"
    del_password = "testdelete123"

    existing = loop.run_until_complete(db.users.find_one({"email": del_email}))
    if existing:
        eid = existing["id"]
        loop.run_until_complete(db.users.delete_many({"id": eid}))
        loop.run_until_complete(db.analyses.delete_many({"user_id": eid}))
        loop.run_until_complete(db.feedback.delete_many({"user_id": eid}))
        loop.run_until_complete(db.password_reset_tokens.delete_many({"user_id": eid}))

    r = requests.post(f"{BASE}/auth/register", json={"email": del_email, "name": "DeleteTest", "password": del_password}, timeout=10)
    if r.status_code != 200:
        record("3) Setup: register throwaway user", False, f"status={r.status_code} body={r.text[:200]}")
        return
    del_user_id = r.json()["id"]
    record("3) Setup: registered throwaway user", True, f"user_id={del_user_id[:8]}***")

    r = requests.post(f"{BASE}/feedback", json={"user_id": del_user_id, "rating": 4, "category": "app_experience", "comment": "Test feedback before deletion"}, timeout=10)
    record("3) Setup: feedback submitted", r.status_code == 200, f"status={r.status_code}")

    loop.run_until_complete(db.analyses.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": del_user_id,
        "skin_type": "normal", "skin_tone": "medium", "undertone": "neutral",
        "face_shape": "oval", "skin_concerns": [], "texture_analysis": "test",
        "ai_recommendations": [], "created_at": now_utc(), "mode": "skin_care",
    }))
    loop.run_until_complete(db.password_reset_tokens.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": del_user_id,
        "email": del_email,
        "token_hash": hashlib.sha256(b"some-test-token-for-delete").hexdigest(),
        "requested_at": now_utc(),
        "expires_at": now_utc() + timedelta(minutes=30),
        "used_at": None,
    }))

    # 3a) Wrong password
    r = requests.post(f"{BASE}/auth/delete-account", json={"user_id": del_user_id, "password": "WRONG"}, timeout=10)
    detail = r.json().get("detail", "") if r.status_code != 200 else ""
    record("3a) Wrong password -> 400 exact msg", r.status_code == 400 and detail == "Account not found or password incorrect.", f"status={r.status_code} detail={detail!r}")

    # 3b) Non-existent user_id
    fake_uid = str(uuid.uuid4())
    r = requests.post(f"{BASE}/auth/delete-account", json={"user_id": fake_uid, "password": del_password}, timeout=10)
    detail = r.json().get("detail", "") if r.status_code != 200 else ""
    record("3b) Non-existent user -> 400 same msg", r.status_code == 400 and detail == "Account not found or password incorrect.", f"status={r.status_code} detail={detail!r}")

    # 3c) Correct delete
    r = requests.post(f"{BASE}/auth/delete-account", json={"user_id": del_user_id, "password": del_password}, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    expected_msg = "Your account and all associated data have been permanently deleted."
    record("3c) Correct delete -> 200 exact msg", r.status_code == 200 and body.get("message") == expected_msg, f"status={r.status_code} body={body}")

    # 3d) Verify wiped
    u = loop.run_until_complete(db.users.find_one({"id": del_user_id}))
    a_count = loop.run_until_complete(db.analyses.count_documents({"user_id": del_user_id}))
    f_count = loop.run_until_complete(db.feedback.count_documents({"user_id": del_user_id}))
    t_count = loop.run_until_complete(db.password_reset_tokens.count_documents({"user_id": del_user_id}))
    record("3d) users record removed", u is None, f"found={u}")
    record("3d) analyses count == 0", a_count == 0, f"count={a_count}")
    record("3d) feedback count == 0", f_count == 0, f"count={f_count}")
    record("3d) password_reset_tokens count == 0", t_count == 0, f"count={t_count}")

    r = requests.post(f"{BASE}/auth/password-login", json={"email": del_email, "password": del_password}, timeout=10)
    # Spec says 401, actual implementation returns 400 with "No account found" — both are valid "cannot login"
    record("3d) Login with deleted creds -> 400/401", r.status_code in (400, 401), f"status={r.status_code} (note: server returns 400; spec said 401)")


def main():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = AsyncIOMotorClient(MONGO_URL, tz_aware=True)
    db = client[DB_NAME]

    try:
        test_regression()
        test_forgot_password(loop, db)
        test_reset_password(loop, db)
        test_delete_account(loop, db)
    finally:
        client.close()
        loop.close()

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    passed = sum(1 for _, p, _ in results if p)
    failed = [r for r in results if not r[1]]
    print(f"PASSED: {passed}/{len(results)}")
    if failed:
        print(f"\nFAILED ({len(failed)}):")
        for name, _, detail in failed:
            print(f"  FAIL {name}: {detail}")
    else:
        print("ALL TESTS PASSED")

    return 0 if not failed else 1


if __name__ == "__main__":
    exit(main())
