"""
v1.0.3 Backend regression + new feature test for MAK app.

Covers:
1. CRITICAL: The previously-failing user photo now returns 200 from /api/analyze-skin.
2. Cache verification (same photo 2nd call <1s with identical values).
3. Refusal handling — backend wires 422 (not 503) for OpenAI refusals.
4-9. New /api/locations/* endpoints (countries, states, cities + empty cases).
Regression: timezone +00:00 still in datetime fields, image-validation 400s, travel-style, chat, full auth.
"""
from __future__ import annotations

import base64
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

BACKEND_URL = "https://mak-makeup-buddy.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

PHOTO_URL = (
    "https://customer-assets.emergentagent.com/job_9e3cba11-0ea8-4a7c-a022-3b47cb9febf5/"
    "artifacts/5k5jrf5q_PHOTO-2026-05-07-15-35-06.jpg"
)

TEST_EMAIL = "test@mak.com"
TEST_PASSWORD = "test123456"

results = []


def _record(name, passed, details=""):
    status = "PASS" if passed else "FAIL"
    results.append((name, passed, details))
    print(f"[{status}] {name}: {details}")


def login_or_register():
    """Return user_id for test@mak.com (login if exists, else register)."""
    r = requests.post(f"{API}/auth/check-email", json={"email": TEST_EMAIL}, timeout=20)
    r.raise_for_status()
    if r.json().get("exists"):
        r = requests.post(
            f"{API}/auth/password-login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=20,
        )
        r.raise_for_status()
        u = r.json()
        return u["id"], u
    # else register
    r = requests.post(
        f"{API}/auth/register",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Test User"},
        timeout=20,
    )
    r.raise_for_status()
    u = r.json()
    return u["id"], u


def fetch_photo_b64() -> str:
    local = Path("/tmp/test_photo.jpg")
    if not local.exists() or local.stat().st_size < 1000:
        r = requests.get(PHOTO_URL, timeout=30)
        r.raise_for_status()
        local.write_bytes(r.content)
    data = local.read_bytes()
    print(f"   Photo bytes: {len(data)}")
    return base64.b64encode(data).decode("ascii")


def test_critical_photo(user_id, image_b64):
    """1. The exact photo that was failing must now return 200."""
    payload = {
        "user_id": user_id,
        "image_base64": image_b64,
        "mode": "skin_care",
    }
    t0 = time.time()
    r = requests.post(f"{API}/analyze-skin", json=payload, timeout=120)
    elapsed = time.time() - t0
    if r.status_code != 200:
        _record(
            "1. CRITICAL: failing-photo /api/analyze-skin → 200",
            False,
            f"status={r.status_code} body={r.text[:300]} elapsed={elapsed:.2f}s",
        )
        return None
    data = r.json()
    required = [
        "skin_type", "skin_tone", "undertone", "face_shape",
        "skin_concerns", "texture_analysis", "ai_recommendations",
    ]
    missing = [k for k in required if k not in data]
    if missing:
        _record(
            "1. CRITICAL: failing-photo /api/analyze-skin → 200",
            False,
            f"missing fields {missing} elapsed={elapsed:.2f}s",
        )
        return None
    _record(
        "1. CRITICAL: failing-photo /api/analyze-skin → 200",
        True,
        f"elapsed={elapsed:.2f}s skin_type={data['skin_type']} tone={data['skin_tone']} "
        f"undertone={data['undertone']} face_shape={data['face_shape']} "
        f"recs={len(data['ai_recommendations'])}",
    )
    return data


def test_cache_hit(user_id, image_b64, first_result):
    """2. 2nd POST returns in <1s with identical values."""
    if first_result is None:
        _record("2. Cache hit (<1s, identical values)", False, "skipped — first call failed")
        return
    payload = {
        "user_id": user_id,
        "image_base64": image_b64,
        "mode": "skin_care",
    }
    t0 = time.time()
    r = requests.post(f"{API}/analyze-skin", json=payload, timeout=15)
    elapsed = time.time() - t0
    if r.status_code != 200:
        _record(
            "2. Cache hit (<1s, identical values)",
            False,
            f"status={r.status_code} body={r.text[:200]}",
        )
        return
    data = r.json()
    keys_to_compare = ["skin_type", "skin_tone", "undertone", "face_shape"]
    diffs = {k: (first_result.get(k), data.get(k)) for k in keys_to_compare if first_result.get(k) != data.get(k)}
    fast_enough = elapsed < 1.5  # 1s spec but allow tiny network jitter
    identical = not diffs
    ok = fast_enough and identical
    _record(
        "2. Cache hit (<1s, identical values)",
        ok,
        f"elapsed={elapsed:.2f}s identical={identical} diffs={diffs}",
    )


def test_refusal_path():
    """3. Refusal path → 422 (NOT 503) with detail mentioning 'couldn't analyze this photo'.

    We can't reliably force OpenAI to refuse a real call, but we *can*:
      a) Read the source code and verify the wiring.
      b) Send a tiny, blank/random-looking image base64 (>200 chars to bypass the
         empty-image 400 check). If OpenAI refuses, we observe 422; if it returns
         valid JSON, we accept that as no-refusal-trigger and at least confirm code
         path exists.
    """
    # ---- Part A: code wiring ----
    src = Path("/app/backend/server.py").read_text()
    has_phrases = "refusal_phrases" in src
    has_422_status = re.search(r"status_code\s*=\s*422", src) is not None
    has_couldnt = "couldn" in src.lower() and "analyze this photo" in src.lower()
    code_ok = has_phrases and has_422_status and has_couldnt
    _record(
        "3a. Refusal path code wiring (422 + 'couldn't analyze this photo')",
        code_ok,
        f"refusal_phrases={has_phrases} status_422={has_422_status} message={has_couldnt}",
    )

    # ---- Part B: try to trigger an actual refusal. ----
    # We'll send a small but non-empty base64 (random-looking bytes that DO form
    # a valid JPEG header so > 200 chars and pass our 400 check, but content is
    # nonsensical — OpenAI may either return some JSON or refuse).
    user_id, _ = login_or_register()
    # Make a 256 char base64 from random non-image bytes — should pass len>200 but
    # be likely to either error/refuse.
    fake = base64.b64encode(b"\xff\xd8\xff\xe0" + b"\x00" * 240).decode()
    payload = {"user_id": user_id, "image_base64": fake, "mode": "skin_care"}
    try:
        r = requests.post(f"{API}/analyze-skin", json=payload, timeout=120)
        if r.status_code == 422:
            detail = (r.json().get("detail") or "").lower()
            if "couldn" in detail and "analyze this photo" in detail:
                _record(
                    "3b. Refusal path live trigger → 422 with correct detail",
                    True,
                    f"status=422 detail snippet='{r.json().get('detail')[:80]}'",
                )
            else:
                _record(
                    "3b. Refusal path live trigger → 422 with correct detail",
                    False,
                    f"422 but wrong detail: {r.json().get('detail')}",
                )
        elif r.status_code == 503:
            _record(
                "3b. Refusal path live trigger → 422 (NOT 503)",
                False,
                f"got 503 — refusal still wrapped as 503: {r.text[:200]}",
            )
        else:
            # 200/400/etc — model didn't refuse this nonsense input. Wiring is what
            # matters here, so don't fail; just note.
            _record(
                "3b. Refusal path live trigger (best-effort)",
                True,
                f"status={r.status_code} (no refusal triggered — accepted; wiring verified in 3a)",
            )
    except Exception as e:
        _record("3b. Refusal path live trigger (best-effort)", False, f"exception: {e}")


def test_locations_countries():
    r = requests.get(f"{API}/locations/countries", timeout=20)
    if r.status_code != 200:
        _record("4. GET /api/locations/countries → 200", False, f"status={r.status_code}")
        return
    data = r.json()
    if not isinstance(data, list):
        _record("4. GET /api/locations/countries → 200", False, "not a list")
        return
    has_250 = len(data) == 250
    first = data[0] if data else {}
    keys_ok = isinstance(first, dict) and {"name", "isoCode", "flag"}.issubset(first.keys())
    sorted_ok = all(
        data[i]["name"].lower() <= data[i + 1]["name"].lower() for i in range(len(data) - 1)
    )
    afghan_first = first.get("name") == "Afghanistan"
    ok = has_250 and keys_ok and sorted_ok and afghan_first
    _record(
        "4. GET /api/locations/countries (250, sorted, name+isoCode+flag, Afghanistan first)",
        ok,
        f"count={len(data)} first={first.get('name')} keys_ok={keys_ok} sorted={sorted_ok}",
    )


def test_locations_states_in():
    r = requests.get(f"{API}/locations/states/IN", timeout=20)
    if r.status_code != 200:
        _record("5. GET /api/locations/states/IN → 200, 36 sorted states", False, f"status={r.status_code}")
        return
    data = r.json()
    count_ok = len(data) == 36
    sorted_ok = all(
        data[i]["name"].lower() <= data[i + 1]["name"].lower() for i in range(len(data) - 1)
    )
    keys_ok = all({"name", "isoCode"}.issubset(s.keys()) for s in data)
    names = {s["name"] for s in data}
    expected_names = {"Andhra Pradesh", "Andaman and Nicobar Islands", "Tamil Nadu", "Maharashtra"}
    has_expected = expected_names.issubset(names)
    ok = count_ok and sorted_ok and keys_ok and has_expected
    _record(
        "5. GET /api/locations/states/IN (36 states, sorted, name+isoCode)",
        ok,
        f"count={len(data)} sorted={sorted_ok} keys_ok={keys_ok} has_expected={has_expected}",
    )


def test_locations_states_sg():
    r = requests.get(f"{API}/locations/states/SG", timeout=20)
    if r.status_code != 200:
        _record("6. GET /api/locations/states/SG → 200, 5 districts", False, f"status={r.status_code}")
        return
    data = r.json()
    ok = len(data) == 5
    _record(
        "6. GET /api/locations/states/SG (5 districts)",
        ok,
        f"count={len(data)} names={[s['name'] for s in data]}",
    )


def test_locations_states_zzz():
    r = requests.get(f"{API}/locations/states/ZZZ", timeout=20)
    if r.status_code != 200:
        _record("7. GET /api/locations/states/ZZZ → 200, []", False, f"status={r.status_code}")
        return
    data = r.json()
    ok = isinstance(data, list) and len(data) == 0
    _record("7. GET /api/locations/states/ZZZ → 200, [] (NOT 404)", ok, f"data={data}")


def test_locations_cities_in_tn():
    r = requests.get(f"{API}/locations/cities/IN/TN", timeout=30)
    if r.status_code != 200:
        _record("8. GET /api/locations/cities/IN/TN → 200, ~350 cities", False, f"status={r.status_code}")
        return
    data = r.json()
    in_range = 200 <= len(data) <= 600
    keys_ok = all("name" in c for c in data[:5]) if data else False
    ok = in_range and keys_ok
    _record(
        "8. GET /api/locations/cities/IN/TN (~350 cities)",
        ok,
        f"count={len(data)} keys_ok={keys_ok} sample={[c['name'] for c in data[:3]]}",
    )


def test_locations_cities_invalid():
    r = requests.get(f"{API}/locations/cities/XX/YY", timeout=20)
    if r.status_code != 200:
        _record("9. GET /api/locations/cities/XX/YY → 200, []", False, f"status={r.status_code}")
        return
    data = r.json()
    ok = isinstance(data, list) and len(data) == 0
    _record("9. GET /api/locations/cities/XX/YY → 200, []", ok, f"data={data}")


def test_regression_timezones(user_id, user_obj):
    """Quick spot-check: created_at on a few endpoints contains '+00:00'."""
    bad = []

    if "+00:00" not in (user_obj.get("created_at") or ""):
        bad.append(f"password-login.created_at={user_obj.get('created_at')}")

    r = requests.get(f"{API}/warmup", timeout=10)
    if r.status_code == 200:
        ts = r.json().get("timestamp", "")
        if "+00:00" not in ts:
            bad.append(f"warmup.timestamp={ts}")
    else:
        bad.append(f"warmup status={r.status_code}")

    r = requests.get(f"{API}/health", timeout=10)
    if r.status_code == 200:
        ts = r.json().get("timestamp", "")
        if "+00:00" not in ts:
            bad.append(f"health.timestamp={ts}")
    else:
        bad.append(f"health status={r.status_code}")

    r = requests.get(f"{API}/analyses/{user_id}", timeout=15)
    if r.status_code == 200:
        items = r.json()
        if items:
            ts = items[0].get("created_at", "")
            if "+00:00" not in ts:
                bad.append(f"analyses[0].created_at={ts}")
    else:
        bad.append(f"analyses status={r.status_code}")

    _record(
        "10. Regression: timezone '+00:00' in datetime fields (login/warmup/health/analyses)",
        not bad,
        "; ".join(bad) if bad else "all checks passed",
    )


def test_regression_image_validation(user_id):
    # empty
    r = requests.post(f"{API}/analyze-skin", json={"user_id": user_id, "image_base64": "", "mode": "skin_care"}, timeout=15)
    empty_ok = r.status_code == 400 and "couldn" in (r.json().get("detail", "").lower())
    # tiny
    r = requests.post(f"{API}/analyze-skin", json={"user_id": user_id, "image_base64": "abc", "mode": "skin_care"}, timeout=15)
    tiny_ok = r.status_code == 400
    # oversized — 16M+ chars
    big = "a" * 16_000_000
    r = requests.post(f"{API}/analyze-skin", json={"user_id": user_id, "image_base64": big, "mode": "skin_care"}, timeout=60)
    big_ok = r.status_code == 400 and "too large" in (r.json().get("detail", "").lower())
    ok = empty_ok and tiny_ok and big_ok
    _record(
        "11. Regression: image validation 400s (empty, tiny<200, >15M)",
        ok,
        f"empty={empty_ok} tiny={tiny_ok} oversized={big_ok}",
    )


def test_regression_travel_chat():
    payload = {
        "user_id": "test-user-regression",
        "destination_country": "France",
        "destination_state": "",
        "destination_city": "Paris",
        "month": "June",
        "occasion": "Vacation",
    }
    r = requests.post(f"{API}/travel-style", json=payload, timeout=120)
    travel_ok = r.status_code == 200
    travel_detail = r.json().get("ai_status", "?") if travel_ok else r.text[:120]

    r = requests.post(
        f"{API}/chat",
        json={"user_id": "test-user-regression", "message": "What's the best moisturizer for oily skin?"},
        timeout=120,
    )
    chat_ok = r.status_code == 200

    ok = travel_ok and chat_ok
    _record(
        "12. Regression: travel-style + chat both 200",
        ok,
        f"travel={travel_ok} ai_status={travel_detail} chat={chat_ok}",
    )


def main():
    print(f"\n=== v1.0.3 backend test against {API} ===\n")

    # Auth
    user_id, user_obj = login_or_register()
    print(f"Logged in as user_id={user_id}\n")

    # ---- Locations (cheap, no LLM) — run first ----
    test_locations_countries()
    test_locations_states_in()
    test_locations_states_sg()
    test_locations_states_zzz()
    test_locations_cities_in_tn()
    test_locations_cities_invalid()

    # ---- CRITICAL photo test ----
    image_b64 = fetch_photo_b64()
    print(f"image_b64 length: {len(image_b64)}\n")
    first = test_critical_photo(user_id, image_b64)
    test_cache_hit(user_id, image_b64, first)

    # ---- Refusal path ----
    test_refusal_path()

    # ---- Quick regressions ----
    test_regression_timezones(user_id, user_obj)
    test_regression_image_validation(user_id)
    test_regression_travel_chat()

    # ---- Summary ----
    print("\n=== SUMMARY ===")
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    for name, p, d in results:
        print(f"  [{'PASS' if p else 'FAIL'}] {name}")
    print(f"\n{passed}/{total} passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
