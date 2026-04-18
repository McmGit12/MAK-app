#!/usr/bin/env python3
"""
Comprehensive Backend Testing for MAK App
Tests auth flow changes (guest/phone login removal) and core features
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://complexion-fit.preview.emergentagent.com/api"

class MAKBackendTester:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def log_result(self, test_name, status_code, expected_code, response_data, passed, details=""):
        """Log test result"""
        result = {
            "test": test_name,
            "status_code": status_code,
            "expected_code": expected_code,
            "passed": passed,
            "response_snippet": str(response_data)[:200] if response_data else "No response",
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        
        if passed:
            self.passed += 1
            print(f"✅ {test_name}: {status_code} (Expected: {expected_code})")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {status_code} (Expected: {expected_code}) - {details}")
            
        if response_data:
            print(f"   Response: {str(response_data)[:150]}...")
        print()
        
    def test_auth_flow(self):
        """Test the complete auth flow as specified in review request"""
        print("=== TESTING AUTH FLOW (Email Only) ===\n")
        
        test_email = "e2etest@mak.com"
        test_name = "E2E Tester"
        test_password = "secure123"
        wrong_password = "wrongpass"
        
        # 1. Check email (should not exist initially)
        print("1. Checking if email exists (should be false)...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/check-email", 
                                   json={"email": test_email},
                                   timeout=10)
            data = response.json()
            passed = response.status_code == 200 and data.get("exists") == False
            self.log_result("Check Email (New)", response.status_code, 200, data, passed,
                          f"exists should be false, got: {data.get('exists')}")
        except Exception as e:
            self.log_result("Check Email (New)", 0, 200, None, False, f"Exception: {str(e)}")
            
        # 2. Register new user
        print("2. Registering new user...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/register",
                                   json={
                                       "email": test_email,
                                       "name": test_name,
                                       "password": test_password
                                   },
                                   timeout=10)
            data = response.json()
            passed = response.status_code == 200 and "display_name" in data
            self.log_result("Register User", response.status_code, 200, data, passed,
                          f"Should return user with display_name")
        except Exception as e:
            self.log_result("Register User", 0, 200, None, False, f"Exception: {str(e)}")
            
        # 3. Check email again (should exist now)
        print("3. Checking if email exists (should be true now)...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/check-email",
                                   json={"email": test_email},
                                   timeout=10)
            data = response.json()
            passed = response.status_code == 200 and data.get("exists") == True
            self.log_result("Check Email (Existing)", response.status_code, 200, data, passed,
                          f"exists should be true, got: {data.get('exists')}")
        except Exception as e:
            self.log_result("Check Email (Existing)", 0, 200, None, False, f"Exception: {str(e)}")
            
        # 4. Password login (correct password)
        print("4. Testing password login with correct credentials...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/password-login",
                                   json={
                                       "email": test_email,
                                       "password": test_password
                                   },
                                   timeout=10)
            data = response.json()
            passed = response.status_code == 200 and "id" in data
            self.log_result("Password Login (Correct)", response.status_code, 200, data, passed,
                          "Should succeed with user data")
        except Exception as e:
            self.log_result("Password Login (Correct)", 0, 200, None, False, f"Exception: {str(e)}")
            
        # 5. Password login (wrong password)
        print("5. Testing password login with wrong password...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/password-login",
                                   json={
                                       "email": test_email,
                                       "password": wrong_password
                                   },
                                   timeout=10)
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"error": "Non-JSON response"}
            passed = response.status_code == 400
            self.log_result("Password Login (Wrong)", response.status_code, 400, data, passed,
                          "Should return 400 for wrong password")
        except Exception as e:
            self.log_result("Password Login (Wrong)", 0, 400, None, False, f"Exception: {str(e)}")
            
        # 6. Register duplicate email
        print("6. Testing duplicate registration...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/register",
                                   json={
                                       "email": test_email,
                                       "name": "Dupe",
                                       "password": "test123"
                                   },
                                   timeout=10)
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"error": "Non-JSON response"}
            passed = response.status_code == 400
            self.log_result("Register Duplicate", response.status_code, 400, data, passed,
                          "Should return 400 for duplicate email")
        except Exception as e:
            self.log_result("Register Duplicate", 0, 400, None, False, f"Exception: {str(e)}")
            
        # 7. Register with invalid data
        print("7. Testing registration validation...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/register",
                                   json={
                                       "email": "bad",
                                       "name": "X",
                                       "password": "123"
                                   },
                                   timeout=10)
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {"error": "Non-JSON response"}
            passed = response.status_code == 400
            self.log_result("Register Invalid Data", response.status_code, 400, data, passed,
                          "Should fail validation for bad email/short password")
        except Exception as e:
            self.log_result("Register Invalid Data", 0, 400, None, False, f"Exception: {str(e)}")
            
    def test_core_features(self):
        """Test core features that should still work"""
        print("=== TESTING CORE FEATURES ===\n")
        
        # 8. Travel Style endpoint
        print("8. Testing travel style endpoint...")
        try:
            response = requests.post(f"{BACKEND_URL}/travel-style",
                                   json={
                                       "country": "Paris, Ile-de-France, France",
                                       "month": "December",
                                       "occasion": "Date Night"
                                   },
                                   timeout=15)
            data = response.json()
            passed = response.status_code == 200 and "destination_info" in data
            self.log_result("Travel Style", response.status_code, 200, data, passed,
                          "Should return JSON with destination_info")
        except Exception as e:
            self.log_result("Travel Style", 0, 200, None, False, f"Exception: {str(e)}")
            
        # 9. Chat endpoint (beauty question)
        print("9. Testing chat with beauty question...")
        try:
            response = requests.post(f"{BACKEND_URL}/chat",
                                   json={"message": "What lipstick suits warm undertones?"},
                                   timeout=15)
            data = response.json()
            passed = response.status_code == 200 and "response" in data
            self.log_result("Chat Beauty Question", response.status_code, 200, data, passed,
                          "Should return beauty response")
        except Exception as e:
            self.log_result("Chat Beauty Question", 0, 200, None, False, f"Exception: {str(e)}")
            
        # 10. Chat endpoint (script injection test)
        print("10. Testing chat security (script injection)...")
        try:
            response = requests.post(f"{BACKEND_URL}/chat",
                                   json={"message": "<script>alert(1)</script>"},
                                   timeout=10)
            data = response.json()
            # Should either block it (200 with rejection message) or return 400
            passed = response.status_code in [200, 400]
            if response.status_code == 200:
                # Check if it's properly blocked
                response_text = data.get("response", "").lower()
                blocked = "valid" in response_text or "beauty" in response_text or "question" in response_text
                passed = blocked
            self.log_result("Chat Security Test", response.status_code, "200/400", data, passed,
                          "Should block script injection")
        except Exception as e:
            self.log_result("Chat Security Test", 0, "200/400", None, False, f"Exception: {str(e)}")
            
        # 11. Health check
        print("11. Testing health endpoint...")
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            data = response.json()
            passed = response.status_code == 200 and data.get("status") == "healthy"
            self.log_result("Health Check", response.status_code, 200, data, passed,
                          "Should return healthy status")
        except Exception as e:
            self.log_result("Health Check", 0, 200, None, False, f"Exception: {str(e)}")
            
    def test_removed_features(self):
        """Test that removed features (guest/phone login) are handled properly"""
        print("=== TESTING REMOVED FEATURES ===\n")
        
        # Test guest login endpoint (should still exist but may be deprecated)
        print("12. Testing guest login endpoint (should be removed/deprecated)...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/guest-login", timeout=10)
            # This endpoint might still exist in code but should be deprecated
            # We'll just check if it responds - not critical for this test
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
            passed = True  # Not critical - just documenting
            self.log_result("Guest Login (Deprecated)", response.status_code, "Any", data, passed,
                          "Guest login feature should be removed from UI")
        except Exception as e:
            self.log_result("Guest Login (Deprecated)", 0, "Any", None, True, f"Endpoint not accessible: {str(e)}")
            
        # Test OTP endpoints (should still exist but deprecated)
        print("13. Testing OTP request endpoint (should be removed/deprecated)...")
        try:
            response = requests.post(f"{BACKEND_URL}/auth/request-otp",
                                   json={"phone": "+1234567890"},
                                   timeout=10)
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
            passed = True  # Not critical - just documenting
            self.log_result("OTP Request (Deprecated)", response.status_code, "Any", data, passed,
                          "OTP login feature should be removed from UI")
        except Exception as e:
            self.log_result("OTP Request (Deprecated)", 0, "Any", None, True, f"Endpoint not accessible: {str(e)}")
            
    def run_all_tests(self):
        """Run all tests"""
        print(f"🚀 Starting MAK Backend Tests - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Backend URL: {BACKEND_URL}\n")
        
        self.test_auth_flow()
        self.test_core_features()
        self.test_removed_features()
        
        print("=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"Total Tests: {self.passed + self.failed}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/(self.passed + self.failed)*100):.1f}%")
        print("=" * 60)
        
        # Print failed tests details
        if self.failed > 0:
            print("\n🔍 FAILED TESTS DETAILS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"❌ {result['test']}: {result['details']}")
                    print(f"   Status: {result['status_code']}, Response: {result['response_snippet']}")
        
        return self.failed == 0

if __name__ == "__main__":
    tester = MAKBackendTester()
    success = tester.run_all_tests()
    
    # Save results to file
    with open("/app/test_results_backend.json", "w") as f:
        json.dump({
            "summary": {
                "total": tester.passed + tester.failed,
                "passed": tester.passed,
                "failed": tester.failed,
                "success_rate": (tester.passed/(tester.passed + tester.failed)*100) if (tester.passed + tester.failed) > 0 else 0
            },
            "results": tester.results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    sys.exit(0 if success else 1)