"""
v1.0.14 Backend Test — Focus on NEW chat harness + regression of P0/P2/P3 endpoints.
Uses external preview URL from /app/frontend/.env (EXPO_PUBLIC_BACKEND_URL).
"""
import os
import sys
import time
import json
import requests

BASE = "https://mak-makeup-buddy.preview.emergentagent.com/api"

TEST_EMAIL = "test@mak.com"
TEST_PASSWORD = "test123456"

results = []  # (category, name, passed, detail)

def log(cat, name, passed, detail=""):
    icon = "PASS" if passed else "FAIL"
    print(f"[{icon}] [{cat}] {name}  {detail[:300]}")
    results.append((cat, name, passed, detail))

def req(method, path, **kw):
    url = f"{BASE}{path}"
    try:
        r = requests.request(method, url, timeout=kw.pop("timeout", 60), **kw)
        return r
    except Exception as e:
        return e


# ---- P0: Health and Auth ----
def test_p0():
    print("\n========== P0: HEALTH & AUTH ==========\n")
    r = req("GET", "/warmup")
    ok = hasattr(r, "status_code") and r.status_code == 200
    log("P0", "GET /api/warmup", ok, f"status={getattr(r,'status_code','ERR')} body={getattr(r,'text','')[:120]}")

    r = req("GET", "/health")
    ok = hasattr(r, "status_code") and r.status_code == 200
    body = {}
    if ok:
        try: body = r.json()
        except: pass
    db_ok = body.get("mongodb") in ("connected", "warm") or body.get("status") in ("healthy", "degraded")
    log("P0", "GET /api/health", ok and db_ok, f"status={getattr(r,'status_code','ERR')} mongodb={body.get('mongodb')} status_field={body.get('status')}")

    r = req("POST", "/auth/check-email", json={"email": TEST_EMAIL})
    ok = r.status_code == 200 and r.json().get("exists") is True
    log("P0", "check-email existing user", ok, f"status={r.status_code} body={r.text[:120]}")

    r = req("POST", "/auth/check-email", json={"email": "totally-new-user-v14@example.com"})
    ok = r.status_code == 200 and r.json().get("exists") is False
    log("P0", "check-email new user", ok, f"status={r.status_code} body={r.text[:120]}")

    r = req("POST", "/auth/check-email", json={"email": "not-an-email"})
    ok = r.status_code == 400
    log("P0", "check-email invalid format", ok, f"status={r.status_code} body={r.text[:120]}")

    r = req("POST", "/auth/check-email", json={"email": ""})
    ok = r.status_code == 400 or r.status_code == 422
    log("P0", "check-email empty", ok, f"status={r.status_code} body={r.text[:120]}")

    r = req("POST", "/auth/password-login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    ok = r.status_code == 200
    user_id = None
    display_name = None
    if ok:
        body = r.json()
        user_id = body.get("id")
        display_name = body.get("display_name")
        ok = bool(user_id) and bool(display_name)
    log("P0", "password-login correct", ok, f"status={r.status_code} user_id={user_id} display_name={display_name}")

    r = req("POST", "/auth/password-login", json={"email": TEST_EMAIL, "password": "WRONG_PASSWORD_X"})
    ok = r.status_code == 400 and "ncorrect" in r.text.lower()
    log("P0", "password-login wrong password", ok, f"status={r.status_code} body={r.text[:200]}")

    r = req("POST", "/auth/password-login", json={"email": "no-such-user-v14-xyz@example.com", "password": "whatever"})
    ok = r.status_code == 400 and "no account" in r.text.lower()
    log("P0", "password-login nonexistent", ok, f"status={r.status_code} body={r.text[:200]}")

    ts = int(time.time())
    new_email = f"v14_user_{ts}@maktest.com"
    r = req("POST", "/auth/register", json={"email": new_email, "name": "Riya Sharma", "password": "secret_v14"})
    ok = r.status_code == 200
    new_uid = r.json().get("id") if ok else None
    log("P0", "register new user", ok, f"status={r.status_code} id={new_uid}")

    r = req("POST", "/auth/register", json={"email": TEST_EMAIL, "name": "Test User", "password": "test123456"})
    ok = r.status_code == 400 and "already exists" in r.text.lower()
    log("P0", "register existing email", ok, f"status={r.status_code} body={r.text[:200]}")

    r = req("POST", "/auth/register", json={"email": f"shortpw_{ts}@maktest.com", "name": "Riya Sharma", "password": "abc"})
    ok = r.status_code == 400
    log("P0", "register short password", ok, f"status={r.status_code} body={r.text[:200]}")

    r = req("POST", "/auth/register", json={"email": f"shortname_{ts}@maktest.com", "name": "R", "password": "validpw123"})
    ok = r.status_code == 400
    log("P0", "register short name", ok, f"status={r.status_code} body={r.text[:200]}")

    if user_id:
        r = req("GET", f"/auth/profile/{user_id}")
        ok = r.status_code == 200
        log("P0", "profile retrieval", ok, f"status={r.status_code} body={r.text[:200]}")

    return user_id


# ---- P1: NEW Chat Harness ----
def test_p1():
    print("\n========== P1: NEW CHAT HARNESS ==========\n")
    filtered_cases = [
        ("empty",           ""),
        ("single char a",   "a"),
        ("two chars ab",    "ab"),
        ("low alpha ratio", "1234567890!@#$%"),
        ("repeated char a", "aaaaaaaaaa"),
        ("repeated dots",   "..........."),
        ("no vowels",       "qwrtpsdfghjklzxcvbnm"),
        ("run-on",          "asdfghjklqwertyuiopzxcvb"),
        ("profanity",       "fucking shit damn"),
        ("script tag",      "<script>alert(1)</script>"),
        ("emoji spam",      "\U0001F970\U0001F484\u2728\U0001F48B\U0001F444\U0001F496\u2728"),
        ("600 char",        "x" * 600),
    ]
    rejection_phrases = [
        "didn't quite catch",
        "i'm not sure what you mean",
        "random text",
        "type a question about beauty",
        "shorter (under 500",
        "valid beauty or makeup",
        "too many emojis",
        "let's keep our conversation positive",
    ]

    for name, msg in filtered_cases:
        r = req("POST", "/chat", json={"message": msg, "session_id": None}, timeout=30)
        try:
            body = r.json()
        except Exception:
            body = {}
        status = getattr(r, "status_code", None)
        ai_status = body.get("ai_status")
        resp = body.get("response", "")
        sess = body.get("session_id")
        looks_filtered = any(p in resp.lower() for p in rejection_phrases)
        if name == "profanity":
            ok = status == 200 and "positive" in resp.lower() and "beauty-focused" in resp.lower()
        else:
            ok = status == 200 and looks_filtered
        # session_id preservation: pass session_id=None → response can be None (only short-circuit branches without ai_status return None);
        # harness branches set ai_status='filtered' but echo back data.session_id which is None — that's expected behaviour.
        print(f"   → raw resp[{name}]: status={status} ai_status={ai_status} session={sess} response={resp[:200]!r}")
        log("P1-filtered", name, ok, f"status={status} ai_status={ai_status} response={resp[:140]!r}")

    # Session preservation when client sends its own session_id
    print("\n--- session_id preservation in filtered branch ---")
    my_sess = "client-supplied-session-v14-xyz"
    r = req("POST", "/chat", json={"message": "qwrtpsdfghjklzxcvbnm", "session_id": my_sess}, timeout=20)
    try:
        body = r.json()
    except Exception:
        body = {}
    ok = r.status_code == 200 and body.get("session_id") == my_sess and body.get("ai_status") == "filtered"
    log("P1-filtered", "session_id preserved when supplied", ok, f"status={r.status_code} got={body.get('session_id')} expected={my_sess} ai_status={body.get('ai_status')}")

    # Valid messages
    print("\n--- Valid beauty messages ---")
    valid_msgs = [
        "What's a good moisturizer for oily skin?",
        "Tips for glowing skin?",
        "I have dry skin, what should I avoid?",
        "Suggest a date-night makeup look",
    ]
    for m in valid_msgs:
        r = req("POST", "/chat", json={"message": m, "session_id": None}, timeout=90)
        try:
            body = r.json()
        except Exception:
            body = {}
        status = getattr(r, "status_code", None)
        ai_status = body.get("ai_status")
        resp = body.get("response", "")
        sess = body.get("session_id")
        ok = status == 200 and ai_status in ("ok", "fallback") and len(resp) > 5 and bool(sess)
        print(f"   → status={status} ai_status={ai_status} sess={sess} resp_len={len(resp)}")
        log("P1-valid", m[:40], ok, f"status={status} ai_status={ai_status} resp_len={len(resp)} resp_preview={resp[:120]!r}")

    # Session memory check
    print("\n--- Session memory check ---")
    r1 = req("POST", "/chat", json={"message": "I have oily skin", "session_id": None}, timeout=90)
    try:
        b1 = r1.json()
    except Exception:
        b1 = {}
    sess1 = b1.get("session_id")
    ok1 = getattr(r1, "status_code", None) == 200 and bool(sess1) and b1.get("ai_status") in ("ok", "fallback")
    print(f"   → msg1: sess={sess1} ai_status={b1.get('ai_status')} resp={b1.get('response','')[:200]!r}")
    log("P1-session", "msg1 oily-skin returns session_id", ok1,
        f"status={getattr(r1,'status_code',None)} session={sess1} ai_status={b1.get('ai_status')}")

    if sess1:
        r2 = req("POST", "/chat", json={"message": "what foundation suits me?", "session_id": sess1}, timeout=90)
        try:
            b2 = r2.json()
        except Exception:
            b2 = {}
        sess2 = b2.get("session_id")
        resp2 = b2.get("response", "")
        same_session = (sess2 == sess1)
        ok = getattr(r2, "status_code", None) == 200 and same_session and b2.get("ai_status") in ("ok", "fallback") and len(resp2) > 5
        contextual = any(w in resp2.lower() for w in ["oily", "matte", "shine", "combination", "oil-control", "control oil", "oil control"])
        print(f"   → msg2: sess={sess2} same={same_session} ai_status={b2.get('ai_status')} contextual_kw={contextual} resp={resp2[:300]!r}")
        log("P1-session", "msg2 reuses session + contextual", ok and contextual,
            f"status={getattr(r2,'status_code',None)} same_sess={same_session} ai_status={b2.get('ai_status')} contextual={contextual} resp_preview={resp2[:200]!r}")


# ---- P2: Analyze flows ----
def test_p2(user_id):
    print("\n========== P2: ANALYZE FLOWS ==========\n")
    if not user_id:
        log("P2", "skipped (no user_id)", False, "user_id not available")
        return

    tiny_png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )
    image_payload = (tiny_png_b64 * 4)[:1000]

    r = req("POST", "/analyze-skin", json={
        "image_base64": image_payload,
        "user_id": user_id,
        "mode": "skin_care"
    }, timeout=120)
    status = getattr(r, "status_code", None)
    body = {}
    try: body = r.json()
    except: pass
    analysis_id = body.get("id")
    # 200=ok, 503/400 graceful are allowed per review request
    ok = status in (200, 503, 504, 400)
    log("P2", "POST /analyze-skin", ok, f"status={status} id={analysis_id} keys={list(body.keys())[:8]} detail={body.get('detail','')[:120]}")

    if analysis_id:
        r = req("GET", f"/analysis/{analysis_id}", timeout=30)
        ok = r.status_code == 200
        log("P2", "GET /analysis/{id}", ok, f"status={r.status_code}")

    r = req("GET", f"/analyses/{user_id}", timeout=30)
    ok = r.status_code == 200 and isinstance(r.json(), list)
    log("P2", "GET /analyses/{user_id}", ok, f"status={r.status_code} count={len(r.json()) if r.status_code==200 else 'n/a'}")

    r = req("POST", "/travel-style", json={
        "country": "France",
        "month": "June",
        "occasion": "Vacation",
        "user_id": user_id
    }, timeout=90)
    status = getattr(r, "status_code", None)
    body = {}
    try: body = r.json()
    except: pass
    ok = status == 200 and ("destination_info" in body or "outfit_suggestions" in body or body.get("ai_status"))
    log("P2", "POST /travel-style", ok, f"status={status} ai_status={body.get('ai_status')} keys={list(body.keys())[:8]}")


# ---- P3: Auxiliary ----
def test_p3(user_id):
    print("\n========== P3: AUXILIARY ==========\n")
    if user_id:
        r = req("POST", "/feedback", json={
            "user_id": user_id,
            "rating": 5,
            "category": "app_experience",
            "comment": "Loving the new chat harness in v1.0.14"
        }, timeout=20)
        ok = r.status_code == 200
        log("P3", "POST /feedback", ok, f"status={r.status_code} body={r.text[:200]}")

    r = req("GET", "/locations/countries", timeout=20)
    if hasattr(r, "status_code") and r.status_code == 200:
        try:
            data = r.json()
        except Exception:
            data = []
        ok = isinstance(data, list) and len(data) > 100
        log("P3", "GET /locations/countries", ok, f"status={r.status_code} count={len(data) if isinstance(data,list) else 'n/a'}")
    else:
        log("P3", "GET /locations/countries", False, f"status={getattr(r,'status_code','ERR')}")

    r = req("POST", "/auth/forgot-password", json={"email": TEST_EMAIL}, timeout=30)
    ok = r.status_code == 200
    log("P3", "POST /auth/forgot-password", ok, f"status={r.status_code} body={r.text[:200]}")

    r = req("POST", "/notify-signup", json={"email": f"waitlist-v14-{int(time.time())}@test.com"}, timeout=20)
    ok = r.status_code == 200
    log("P3", "POST /notify-signup", ok, f"status={r.status_code} body={r.text[:200]}")


def summary():
    print("\n\n========== SUMMARY ==========\n")
    by_cat = {}
    for cat, _, ok, _ in results:
        by_cat.setdefault(cat, [0, 0])
        by_cat[cat][0] += 1
        if ok:
            by_cat[cat][1] += 1
    for cat, (tot, p) in by_cat.items():
        print(f"  {cat}: {p}/{tot} passed")
    total = len(results)
    passed = sum(1 for _, _, o, _ in results if o)
    print(f"\nTOTAL: {passed}/{total} passed")
    print("\n--- FAILURES ---")
    for cat, name, ok, detail in results:
        if not ok:
            print(f"  [{cat}] {name}: {detail}")


if __name__ == "__main__":
    user_id = test_p0()
    test_p1()
    test_p2(user_id)
    test_p3(user_id)
    summary()
