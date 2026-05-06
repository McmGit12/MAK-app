"""v1.0.2 timezone-only re-verification test."""
import os, sys, time, json
import requests

BASE = "https://mak-makeup-buddy.preview.emergentagent.com/api"

def check(name, value):
    if value is None:
        print(f"  ❌ {name}: created_at is None/missing")
        return False
    has_offset = "+00:00" in value
    has_z = value.endswith("Z")
    if has_offset:
        print(f"  ✅ {name}: {value}")
        return True
    if has_z:
        print(f"  ❌ {name}: {value}  (uses 'Z' instead of '+00:00')")
        return False
    print(f"  ❌ {name}: {value}  (NAIVE — no timezone suffix)")
    return False

results = {}

# 1. Register fresh user
print("\n[1] POST /api/auth/register (fresh user)")
ts = int(time.time())
fresh_email = f"tz_test_{ts}@mak.com"
r = requests.post(f"{BASE}/auth/register", json={
    "email": fresh_email,
    "password": "Tz_Test_9999",
    "name": "TZ Test User"
}, timeout=30)
print(f"  status={r.status_code}")
data = r.json() if r.ok else {}
fresh_user_id = data.get("id")
print(f"  body keys: {list(data.keys())}")
results["register"] = check("register.created_at", data.get("created_at"))

# 2. Password login (existing seed user)
print("\n[2] POST /api/auth/password-login (test@mak.com)")
r = requests.post(f"{BASE}/auth/password-login", json={
    "email": "test@mak.com",
    "password": "test123456"
}, timeout=30)
print(f"  status={r.status_code}")
data = r.json() if r.ok else {}
print(f"  body keys: {list(data.keys())}")
results["password_login"] = check("password-login.created_at", data.get("created_at"))
existing_user_id = data.get("id")

# 3. GET /api/analyses/{user_id} for user with at least 1 analysis
target_uid = "9e846c3c-f6b1-49fc-98f9-a3f9c7925d78"
print(f"\n[3] GET /api/analyses/{target_uid}")
r = requests.get(f"{BASE}/analyses/{target_uid}", timeout=30)
print(f"  status={r.status_code}")
arr = r.json() if r.ok else []
print(f"  count={len(arr) if isinstance(arr, list) else 'N/A'}")
ok = True
if isinstance(arr, list) and len(arr) > 0:
    for i, item in enumerate(arr[:5]):
        ok = check(f"analyses[{i}].created_at", item.get("created_at")) and ok
else:
    print("  ⚠️  no analyses for that user — trying existing seed user instead")
    if existing_user_id:
        r2 = requests.get(f"{BASE}/analyses/{existing_user_id}", timeout=30)
        arr2 = r2.json() if r2.ok else []
        print(f"  fallback count={len(arr2) if isinstance(arr2, list) else 'N/A'}")
        if isinstance(arr2, list) and len(arr2) > 0:
            for i, item in enumerate(arr2[:5]):
                ok = check(f"analyses[{i}].created_at", item.get("created_at")) and ok
        else:
            print("  ⚠️  No analyses available to test list serialization.")
            ok = False
results["analyses_list"] = ok

# 4. GET /api/auth/profile/{user_id}
print(f"\n[4] GET /api/auth/profile/{existing_user_id}")
r = requests.get(f"{BASE}/auth/profile/{existing_user_id}", timeout=30)
print(f"  status={r.status_code}")
data = r.json() if r.ok else {}
results["profile"] = check("profile.created_at", data.get("created_at"))

# 5. POST /api/feedback
print(f"\n[5] POST /api/feedback")
r = requests.post(f"{BASE}/feedback", json={
    "user_id": existing_user_id,
    "rating": 5,
    "category": "app_experience",
    "comment": "TZ verification test"
}, timeout=30)
print(f"  status={r.status_code}")
data = r.json() if r.ok else {}
print(f"  body keys: {list(data.keys())}")
results["feedback"] = check("feedback.created_at", data.get("created_at"))

# 6. GET /api/warmup
print(f"\n[6] GET /api/warmup")
r = requests.get(f"{BASE}/warmup", timeout=30)
print(f"  status={r.status_code}")
data = r.json() if r.ok else {}
results["warmup"] = check("warmup.timestamp", data.get("timestamp"))

# 7. GET /api/health
print(f"\n[7] GET /api/health")
r = requests.get(f"{BASE}/health", timeout=30)
print(f"  status={r.status_code}")
data = r.json() if r.ok else {}
results["health"] = check("health.timestamp", data.get("timestamp"))

# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
all_pass = True
for k, v in results.items():
    print(f"  {'✅' if v else '❌'} {k}")
    all_pass = all_pass and v

print(f"\nOVERALL: {'ALL 7 PASS — DEPLOYMENT-READY' if all_pass else 'SOME FAILED'}")
sys.exit(0 if all_pass else 1)
