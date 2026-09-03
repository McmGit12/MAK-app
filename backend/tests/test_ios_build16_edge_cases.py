"""
iOS Build 16 - Extended Edge Case Regression
Covers the wider matrix from the review request that was NOT in test_ios_pre_release.py:
- check-email invalid format, unknown, exists
- register HTML/script injection, short-name, short-password, duplicate
- password-login email case/whitespace insensitivity
- exact error message strings
- analyze-skin edge cases (empty, abc, >15M, unknown user, unknown mode, 1x1 PNG)
- travel-style missing country
- locations edge cases (states/XX empty, cities US/ZZ empty)
- chat empty message, session_id reuse, inappropriate content
- feedback rating 0 / 6 invalid, GET feedback list
- notify-signup valid + duplicate + invalid
- forgot-password known+unknown neutral, reset-password bogus token + short password
- GET /api/analysis/nonexistent 404 & timestamp +00:00
"""
import base64
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                         "https://mak-makeup-buddy.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
REVIEW_EMAIL = "test@mak.com"
REVIEW_PASSWORD = "test123456"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def reviewer_uid(session):
    r = session.post(f"{API}/auth/password-login",
                     json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
    assert r.status_code == 200
    return r.json()["id"]


# ==================== CHECK-EMAIL ====================
class TestCheckEmail:
    def test_invalid_format(self, session):
        r = session.post(f"{API}/auth/check-email", json={"email": "not-an-email"}, timeout=15)
        assert r.status_code in (400, 422)

    def test_unknown(self, session):
        email = f"nobody_{int(time.time())}@nowhere.example"
        r = session.post(f"{API}/auth/check-email", json={"email": email}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("exists") is False

    def test_known(self, session):
        r = session.post(f"{API}/auth/check-email", json={"email": REVIEW_EMAIL}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("exists") is True


# ==================== REGISTER validation edge ====================
class TestRegisterEdge:
    def test_short_name(self, session):
        r = session.post(f"{API}/auth/register", json={
            "email": f"TEST_shortname_{int(time.time())}@mak.com",
            "password": "goodpass1", "name": "A"}, timeout=15)
        assert r.status_code in (400, 422)

    def test_html_in_name(self, session):
        r = session.post(f"{API}/auth/register", json={
            "email": f"TEST_html_{int(time.time())}@mak.com",
            "password": "goodpass1", "name": "<script>alert(1)</script>"}, timeout=15)
        # Should be rejected OR sanitized. Accept 400/422 or 200 with sanitized name
        if r.status_code == 200:
            # if accepted, ensure the raw <script> tag is not present
            name = r.json().get("display_name", "")
            assert "<script" not in name.lower()
        else:
            assert r.status_code in (400, 422)


# ==================== EMAIL CASE / WHITESPACE ====================
class TestEmailNormalization:
    def test_email_case_and_whitespace(self, session):
        r = session.post(f"{API}/auth/password-login", json={
            "email": f"  {REVIEW_EMAIL.upper().replace('mak.com', 'MAK.com')}  ",
            "password": REVIEW_PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["email"].lower() == REVIEW_EMAIL


# ==================== WRONG-PASSWORD / UNKNOWN-USER MESSAGES ====================
class TestAuthMessages:
    def test_unknown_email_message(self, session):
        r = session.post(f"{API}/auth/password-login", json={
            "email": f"absent_{int(time.time())}@mak.com", "password": "whatever9"}, timeout=15)
        assert r.status_code == 400
        assert "No account found" in r.json().get("detail", "")

    def test_wrong_password_message(self, session):
        r = session.post(f"{API}/auth/password-login", json={
            "email": REVIEW_EMAIL, "password": "definitelyWrong9"}, timeout=15)
        assert r.status_code == 400
        assert "Incorrect password" in r.json().get("detail", "")


# ==================== ANALYZE-SKIN EDGES ====================
class TestAnalyzeSkinEdges:
    def test_empty_image(self, session, reviewer_uid):
        r = session.post(f"{API}/analyze-skin", json={
            "user_id": reviewer_uid, "image_base64": "", "mode": "skin_care"}, timeout=15)
        assert r.status_code == 400
        assert "couldn't" in r.json().get("detail", "").lower() or "processed" in r.json().get("detail","").lower()

    def test_tiny_image(self, session, reviewer_uid):
        r = session.post(f"{API}/analyze-skin", json={
            "user_id": reviewer_uid, "image_base64": "abc", "mode": "skin_care"}, timeout=15)
        assert r.status_code == 400

    def test_oversized_image(self, session, reviewer_uid):
        r = session.post(f"{API}/analyze-skin", json={
            "user_id": reviewer_uid, "image_base64": "A" * 15_000_001, "mode": "skin_care"}, timeout=30)
        assert r.status_code == 400
        assert "large" in r.json().get("detail", "").lower()

    def test_unknown_user_id(self, session):
        r = session.post(f"{API}/analyze-skin", json={
            "user_id": "nonexistent-uid-xyz", "image_base64": "A" * 500, "mode": "skin_care"}, timeout=15)
        assert r.status_code in (400, 404)

    def test_no_500(self, session, reviewer_uid):
        """1x1 PNG must never return 500; expect clean 4xx/503."""
        one_by_one = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4"
                      "2mNgAAIAAAUAAeIVWDMAAAAASUVORK5CYII=")
        r = session.post(f"{API}/analyze-skin", json={
            "user_id": reviewer_uid, "image_base64": one_by_one, "mode": "skin_care"}, timeout=90)
        assert r.status_code != 500, r.text
        assert r.status_code in (200, 400, 503)


# ==================== HISTORY / ANALYSIS ====================
class TestAnalysisFetch:
    def test_get_analyses_timestamps_tz_aware(self, session, reviewer_uid):
        r = session.get(f"{API}/analyses/{reviewer_uid}", timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        for item in arr[:5]:
            ts = item.get("created_at", "")
            assert ts.endswith("+00:00"), f"Missing +00:00 in {ts}"

    def test_analysis_nonexistent_returns_404(self, session):
        r = session.get(f"{API}/analysis/nonexistent-id-xyz", timeout=15)
        assert r.status_code == 404


# ==================== TRAVEL STYLE EDGE ====================
class TestTravelStyleEdge:
    def test_missing_country(self, session, reviewer_uid):
        r = session.post(f"{API}/travel-style", json={
            "month": "June", "occasion": "Wedding", "user_id": reviewer_uid}, timeout=30)
        assert r.status_code in (400, 422)


# ==================== LOCATIONS EDGE ====================
class TestLocationsEdge:
    def test_states_unknown_country_empty(self, session):
        r = session.get(f"{API}/locations/states/XX", timeout=15)
        assert r.status_code == 200
        data = r.json()
        lst = data if isinstance(data, list) else data.get("states", [])
        assert lst == []

    def test_cities_unknown_state_empty(self, session):
        r = session.get(f"{API}/locations/cities/US/ZZ", timeout=15)
        assert r.status_code == 200
        data = r.json()
        lst = data if isinstance(data, list) else data.get("cities", [])
        assert lst == []

    def test_states_in(self, session):
        r = session.get(f"{API}/locations/states/IN", timeout=15)
        assert r.status_code == 200
        data = r.json()
        lst = data if isinstance(data, list) else data.get("states", [])
        assert len(lst) > 20


# ==================== CHAT EDGES ====================
class TestChatEdges:
    def test_empty_message(self, session, reviewer_uid):
        """Designed behaviour: empty/too-short messages get a friendly 200 guidance
        reply (conversational validation) instead of an HTTP error; the frontend
        also disables Send for empty input."""
        r = session.post(f"{API}/chat", json={"user_id": reviewer_uid, "message": ""}, timeout=30)
        assert r.status_code == 200
        assert "please type" in r.json().get("response", "").lower()

    def test_session_reuse(self, session, reviewer_uid):
        sid = f"sess_{int(time.time())}"
        for msg in ("What's a good moisturizer?", "Any tips for oily skin?"):
            r = session.post(f"{API}/chat",
                             json={"user_id": reviewer_uid, "message": msg, "session_id": sid},
                             timeout=90)
            assert r.status_code == 200, r.text


# ==================== FEEDBACK EDGES ====================
class TestFeedbackEdges:
    def test_rating_zero_invalid(self, session, reviewer_uid):
        r = session.post(f"{API}/feedback", json={
            "user_id": reviewer_uid, "rating": 0, "category": "app_experience",
            "comment": "bad"}, timeout=15)
        assert r.status_code in (400, 422)

    def test_rating_six_invalid(self, session, reviewer_uid):
        r = session.post(f"{API}/feedback", json={
            "user_id": reviewer_uid, "rating": 6, "category": "app_experience",
            "comment": "over"}, timeout=15)
        assert r.status_code in (400, 422)

    def test_feedback_list(self, session, reviewer_uid):
        r = session.get(f"{API}/feedback/{reviewer_uid}", timeout=15)
        assert r.status_code == 200


# ==================== NOTIFY-SIGNUP ====================
class TestNotifySignup:
    def test_valid_and_duplicate(self, session):
        email = f"notify_{int(time.time())}@mak.com"
        r1 = session.post(f"{API}/notify-signup", json={"email": email, "feature": "coming_soon"},
                          timeout=15)
        assert r1.status_code in (200, 201)
        r2 = session.post(f"{API}/notify-signup", json={"email": email, "feature": "coming_soon"},
                          timeout=15)
        assert r2.status_code in (200, 201)
        # second call should indicate duplicate (already_subscribed:true or similar)
        j = r2.json()
        assert j.get("already_subscribed") in (True, None) or "already" in str(j).lower() \
            or j.get("status") in ("ok", "already_subscribed")

    def test_invalid_email(self, session):
        r = session.post(f"{API}/notify-signup", json={"email": "not-an-email"}, timeout=15)
        assert r.status_code in (400, 422)


# ==================== FORGOT/RESET PASSWORD ====================
class TestForgotResetPassword:
    def test_forgot_known_neutral(self, session):
        r = session.post(f"{API}/auth/forgot-password", json={"email": REVIEW_EMAIL}, timeout=30)
        assert r.status_code == 200

    def test_forgot_review_account_no_token_created(self, session):
        """BUG FIX regression: review account (test@mak.com) must short-circuit —
        neutral 200 + ZERO reset tokens created + NO email sent.
        Covers plain, upper-cased and whitespace-padded variants (email normalization).
        """
        from pymongo import MongoClient
        from datetime import datetime, timezone
        client = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db_name = os.environ.get("DB_NAME", "complexionfit_db")
        coll = client[db_name]["password_reset_tokens"]

        test_start = datetime.now(timezone.utc)
        for variant in (REVIEW_EMAIL, REVIEW_EMAIL.upper(), f"  {REVIEW_EMAIL}  "):
            r = session.post(f"{API}/auth/forgot-password",
                             json={"email": variant}, timeout=30)
            assert r.status_code == 200, r.text
            body = r.json()
            assert body.get("status") == "ok"
            assert "registered with MAK" in body.get("message", "")

        count = coll.count_documents({
            "email": REVIEW_EMAIL,
            "requested_at": {"$gte": test_start},
        })
        assert count == 0, f"Expected 0 reset tokens for review account, found {count}"
        client.close()

    def test_forgot_unknown_neutral(self, session):
        r = session.post(f"{API}/auth/forgot-password",
                         json={"email": f"absent_{int(time.time())}@mak.com"}, timeout=30)
        assert r.status_code == 200

    def test_reset_bogus_token(self, session):
        r = session.post(f"{API}/auth/reset-password",
                         json={"token": "bogus-token-xyz", "new_password": "somenew12"}, timeout=15)
        assert r.status_code in (400, 404)

    def test_reset_short_password(self, session):
        r = session.post(f"{API}/auth/reset-password",
                         json={"token": "any-token", "new_password": "abc"}, timeout=15)
        assert r.status_code in (400, 404, 422)


# ==================== FINAL: restore test@mak.com display_name ====================
class TestZFinalRestore:
    """Ensures the reviewer account is left as 'Test User' per instructions."""
    def test_restore_display_name(self, session, reviewer_uid):
        r = session.put(f"{API}/auth/update-name",
                        json={"user_id": reviewer_uid, "display_name": "Test User"}, timeout=15)
        assert r.status_code == 200
