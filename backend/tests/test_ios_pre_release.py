"""
Pre-iOS Build Backend Regression Suite (v1.0.15)
Covers self-healing reviewer account, auth flows, analysis, travel-style, chat,
feedback, locations, and forgot-password per iOS pre-release review request.
"""
import os
import base64
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mak-makeup-buddy.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

REVIEW_EMAIL = "test@mak.com"
REVIEW_PASSWORD = "test123456"

# Real face photo (per review request)
FACE_PHOTO_URL = "https://customer-assets.emergentagent.com/job_9e3cba11-0ea8-4a7c-a022-3b47cb9febf5/artifacts/5k5jrf5q_PHOTO-2026-05-07-15-35-06.jpg"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def face_photo_b64():
    r = requests.get(FACE_PHOTO_URL, timeout=30)
    r.raise_for_status()
    return base64.b64encode(r.content).decode()


# ============== HEALTH & WARMUP ==============
class TestHealth:
    def test_health(self, session):
        r = session.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        j = r.json()
        assert j["mongodb"] == "connected"
        assert j["llm_key_configured"] is True

    def test_warmup_fast(self, session):
        t0 = time.time()
        r = session.get(f"{API}/warmup", timeout=10)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 5, f"Warmup took {elapsed}s"


# ============== SELF-HEALING REVIEWER ACCOUNT ==============
class TestReviewAccountSelfHeal:
    """Critical: Google Play/App Store reviewer login must always work."""

    def test_1_review_password_login_ok(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["email"] == REVIEW_EMAIL
        assert "id" in u

    def test_2_change_password_self_heal(self, session):
        # login and get user_id
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        assert r.status_code == 200
        uid = r.json()["id"]

        # change password
        cp = session.post(f"{API}/auth/change-password",
                         json={"user_id": uid, "current_password": REVIEW_PASSWORD,
                               "new_password": "Temp98765"}, timeout=30)
        assert cp.status_code == 200, cp.text

        # login with original test123456 must still work (self-heal)
        time.sleep(1)
        r2 = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        assert r2.status_code == 200, f"Self-heal failed: {r2.status_code} {r2.text}"

    def test_3_wrong_password_message(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": "wrongpass9"}, timeout=30)
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "Incorrect password" in detail, f"Got: {detail}"

    def test_4_delete_and_recreate(self, session):
        # get uid
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        assert r.status_code == 200
        uid = r.json()["id"]

        d = session.post(f"{API}/auth/delete-account",
                         json={"user_id": uid, "password": REVIEW_PASSWORD}, timeout=30)
        assert d.status_code == 200, d.text

        # check-email should still show exists=true (recreated on the fly)
        time.sleep(1)
        ce = session.post(f"{API}/auth/check-email", json={"email": REVIEW_EMAIL}, timeout=30)
        assert ce.status_code == 200
        assert ce.json().get("exists") is True, f"Not recreated: {ce.json()}"

        # login again with original creds → 200 with display_name MAK Reviewer
        r3 = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        assert r3.status_code == 200
        u = r3.json()
        assert u["display_name"] == "MAK Reviewer", f"display_name={u.get('display_name')}"

        # Rename back to 'Test User' as instructed
        rn = session.put(f"{API}/auth/update-name",
                         json={"user_id": u["id"], "display_name": "Test User"}, timeout=30)
        assert rn.status_code == 200


# ============== LOCATIONS ==============
class TestLocations:
    def test_countries(self, session):
        r = session.get(f"{API}/locations/countries", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # could be list or {countries:[...]}
        lst = data if isinstance(data, list) else data.get("countries", [])
        assert len(lst) > 50

    def test_states_us(self, session):
        r = session.get(f"{API}/locations/states/US", timeout=15)
        assert r.status_code == 200
        data = r.json()
        lst = data if isinstance(data, list) else data.get("states", [])
        assert len(lst) > 20

    def test_cities_us_ca(self, session):
        r = session.get(f"{API}/locations/cities/US/CA", timeout=15)
        assert r.status_code == 200
        data = r.json()
        lst = data if isinstance(data, list) else data.get("cities", [])
        assert len(lst) > 5


# ============== TRAVEL STYLE ==============
class TestTravelStyle:
    def test_travel_style_japan(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        uid = r.json()["id"]
        r = session.post(f"{API}/travel-style",
                         json={"country": "Japan", "month": "April", "occasion": "Vacation",
                               "user_id": uid}, timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "destination_info" in j
        assert "outfit_suggestions" in j
        assert "makeup_look" in j


# ============== SKIN ANALYSIS (Real face photo + cache) ==============
class TestSkinAnalysis:
    def test_analyze_skin_care(self, session, face_photo_b64):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        uid = r.json()["id"]
        payload = {"user_id": uid, "image_base64": face_photo_b64, "mode": "skin_care"}
        t0 = time.time()
        r1 = session.post(f"{API}/analyze-skin", json=payload, timeout=90)
        elapsed1 = time.time() - t0
        assert r1.status_code == 200, r1.text
        j1 = r1.json()
        assert "skin_type" in j1 and "skin_tone" in j1 and "undertone" in j1

        # 2nd call - cache hit fast
        t0 = time.time()
        r2 = session.post(f"{API}/analyze-skin", json=payload, timeout=90)
        elapsed2 = time.time() - t0
        assert r2.status_code == 200
        j2 = r2.json()
        assert j1["skin_type"] == j2["skin_type"]
        assert j1["skin_tone"] == j2["skin_tone"]
        assert j1["undertone"] == j2["undertone"]
        assert elapsed2 < 5, f"Cache hit slow: {elapsed2}s (first={elapsed1}s)"

    def test_analyze_makeup(self, session, face_photo_b64):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        uid = r.json()["id"]
        payload = {"user_id": uid, "image_base64": face_photo_b64, "mode": "makeup"}
        r1 = session.post(f"{API}/analyze-skin", json=payload, timeout=90)
        assert r1.status_code == 200, r1.text
        j = r1.json()
        assert "recommendations" in j or "makeup_look" in j or "skin_type" in j

    def test_history_lists_analysis(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        uid = r.json()["id"]
        h = session.get(f"{API}/analyses/{uid}", timeout=15)
        assert h.status_code == 200
        arr = h.json()
        assert isinstance(arr, list)


# ============== CHAT ==============
class TestChat:
    def test_chat_beauty_question(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        uid = r.json()["id"]
        r = session.post(f"{API}/chat",
                         json={"user_id": uid, "message": "Best moisturizer for oily skin?"}, timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ai_status") in ("ok", "retried")
        assert "response" in j or "message" in j

    def test_chat_non_beauty_redirect(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        uid = r.json()["id"]
        r = session.post(f"{API}/chat",
                         json={"user_id": uid, "message": "Who won the football world cup 2022?"}, timeout=90)
        assert r.status_code == 200


# ============== FEEDBACK ==============
class TestFeedback:
    def test_feedback_submit(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": REVIEW_EMAIL, "password": REVIEW_PASSWORD}, timeout=30)
        uid = r.json()["id"]
        f = session.post(f"{API}/feedback",
                         json={"user_id": uid, "rating": 5, "category": "app_experience",
                               "comment": "iOS QA"}, timeout=15)
        assert f.status_code == 200, f.text


# ============== FORGOT PASSWORD ==============
class TestForgotPassword:
    def test_forgot_password_neutral(self, session):
        r = session.post(f"{API}/auth/forgot-password", json={"email": REVIEW_EMAIL}, timeout=30)
        assert r.status_code == 200


# ============== REGISTRATION VALIDATION ==============
class TestRegistrationValidation:
    def test_bad_email(self, session):
        r = session.post(f"{API}/auth/register",
                         json={"email": "not-an-email", "password": "somepass1", "name": "TEST_bad"},
                         timeout=15)
        assert r.status_code in (400, 422), r.text

    def test_short_password(self, session):
        r = session.post(f"{API}/auth/register",
                         json={"email": f"TEST_shortpwd_{int(time.time())}@mak.com", "password": "abc",
                               "name": "TEST_short"}, timeout=15)
        assert r.status_code in (400, 422), r.text

    def test_duplicate_email(self, session):
        r = session.post(f"{API}/auth/register",
                         json={"email": REVIEW_EMAIL, "password": "someOtherPass9",
                               "name": "dup"}, timeout=15)
        assert r.status_code in (400, 422), r.text


# ============== QA USER: register → change password → delete ==============
class TestQAUserLifecycle:
    QA_EMAIL = f"ios_qa_{int(time.time())}@mak.com"
    QA_PWD = "qapass12345"
    QA_NEW_PWD = "newqapass9876"
    qa_uid = None

    def test_a_register(self, session):
        r = session.post(f"{API}/auth/register",
                         json={"email": self.QA_EMAIL, "password": self.QA_PWD,
                               "name": "TEST_QA_User"}, timeout=15)
        assert r.status_code == 200, r.text
        TestQAUserLifecycle.qa_uid = r.json()["id"]

    def test_b_change_password(self, session):
        assert TestQAUserLifecycle.qa_uid is not None
        r = session.post(f"{API}/auth/change-password",
                         json={"user_id": TestQAUserLifecycle.qa_uid,
                               "current_password": self.QA_PWD,
                               "new_password": self.QA_NEW_PWD}, timeout=15)
        assert r.status_code == 200

    def test_c_old_password_fails(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": self.QA_EMAIL, "password": self.QA_PWD}, timeout=15)
        assert r.status_code == 400

    def test_d_new_password_works(self, session):
        r = session.post(f"{API}/auth/password-login",
                         json={"email": self.QA_EMAIL, "password": self.QA_NEW_PWD}, timeout=15)
        assert r.status_code == 200

    def test_e_delete_account(self, session):
        assert TestQAUserLifecycle.qa_uid is not None
        r = session.post(f"{API}/auth/delete-account",
                         json={"user_id": TestQAUserLifecycle.qa_uid,
                               "password": self.QA_NEW_PWD}, timeout=15)
        assert r.status_code == 200

    def test_f_check_email_gone(self, session):
        r = session.post(f"{API}/auth/check-email", json={"email": self.QA_EMAIL}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("exists") is False
