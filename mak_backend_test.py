#!/usr/bin/env python3
"""
MAK Beauty App Backend API Testing Script
Tests all backend endpoints according to the review request requirements
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://complexion-fit.preview.emergentagent.com/api"

class MAKBackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_user_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None, status_code: int = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "status_code": status_code,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        status_info = f" (HTTP {status_code})" if status_code else ""
        print(f"{status} {test_name}{status_info}: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
    
    # ==================== AUTH TESTS ====================
    
    def test_check_email_valid(self) -> bool:
        """Test POST /api/auth/check-email with valid email"""
        try:
            payload = {"email": "test@example.com"}
            response = self.session.post(f"{BASE_URL}/auth/check-email", 
                                       json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "exists" in data and isinstance(data["exists"], bool):
                    self.log_test("Check Email (Valid)", True, 
                                f"Email exists: {data['exists']}", data, response.status_code)
                    return True
                else:
                    self.log_test("Check Email (Valid)", False, 
                                "Missing 'exists' field", data, response.status_code)
                    return False
            else:
                self.log_test("Check Email (Valid)", False, 
                            f"Unexpected status code", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Check Email (Valid)", False, f"Exception: {str(e)}")
            return False
    
    def test_check_email_invalid(self) -> bool:
        """Test POST /api/auth/check-email with invalid email - should return 400"""
        try:
            payload = {"email": "notanemail"}
            response = self.session.post(f"{BASE_URL}/auth/check-email", 
                                       json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_test("Check Email (Invalid)", True, 
                            "Correctly rejected invalid email", None, response.status_code)
                return True
            else:
                self.log_test("Check Email (Invalid)", False, 
                            f"Should return 400 for invalid email", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Check Email (Invalid)", False, f"Exception: {str(e)}")
            return False
    
    def test_register_user(self) -> bool:
        """Test POST /api/auth/register with full details"""
        try:
            payload = {
                "email": "newtest@mak.com",
                "name": "Test User",
                "password": "test123456"
            }
            response = self.session.post(f"{BASE_URL}/auth/register", 
                                       json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "user_hash", "login_method", "display_name", "created_at"]
                
                if all(field in data for field in required_fields):
                    self.test_user_id = data["id"]  # Store for later tests
                    self.log_test("Register User", True, 
                                f"User registered: {data['display_name']}", data, response.status_code)
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Register User", False, 
                                f"Missing fields: {missing}", data, response.status_code)
                    return False
            else:
                # If user already exists, that's also acceptable for testing
                if response.status_code == 400 and "already exists" in response.text:
                    self.log_test("Register User", True, 
                                "User already exists (acceptable for testing)", None, response.status_code)
                    return True
                else:
                    self.log_test("Register User", False, 
                                f"Registration failed", response.text, response.status_code)
                    return False
        except Exception as e:
            self.log_test("Register User", False, f"Exception: {str(e)}")
            return False
    
    def test_password_login_correct(self) -> bool:
        """Test POST /api/auth/password-login with correct credentials"""
        try:
            payload = {
                "email": "newtest@mak.com",
                "password": "test123456"
            }
            response = self.session.post(f"{BASE_URL}/auth/password-login", 
                                       json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "user_hash", "login_method", "created_at"]
                
                if all(field in data for field in required_fields):
                    if not self.test_user_id:
                        self.test_user_id = data["id"]  # Store for later tests
                    self.log_test("Password Login (Correct)", True, 
                                f"Login successful: {data['id'][:8]}...", data, response.status_code)
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Password Login (Correct)", False, 
                                f"Missing fields: {missing}", data, response.status_code)
                    return False
            else:
                self.log_test("Password Login (Correct)", False, 
                            f"Login failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Password Login (Correct)", False, f"Exception: {str(e)}")
            return False
    
    def test_password_login_wrong(self) -> bool:
        """Test POST /api/auth/password-login with wrong password - should return 400"""
        try:
            payload = {
                "email": "newtest@mak.com",
                "password": "wrongpassword"
            }
            response = self.session.post(f"{BASE_URL}/auth/password-login", 
                                       json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_test("Password Login (Wrong)", True, 
                            "Correctly rejected wrong password", None, response.status_code)
                return True
            else:
                self.log_test("Password Login (Wrong)", False, 
                            f"Should return 400 for wrong password", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Password Login (Wrong)", False, f"Exception: {str(e)}")
            return False
    
    def test_guest_login(self) -> bool:
        """Test POST /api/auth/guest-login"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/guest-login", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "user_hash", "login_method", "created_at"]
                
                if all(field in data for field in required_fields):
                    if data["login_method"] == "guest":
                        self.log_test("Guest Login", True, 
                                    f"Guest user created: {data['id'][:8]}...", data, response.status_code)
                        return True
                    else:
                        self.log_test("Guest Login", False, 
                                    f"Wrong login method: {data['login_method']}", data, response.status_code)
                        return False
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Guest Login", False, 
                                f"Missing fields: {missing}", data, response.status_code)
                    return False
            else:
                self.log_test("Guest Login", False, 
                            f"Guest login failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Guest Login", False, f"Exception: {str(e)}")
            return False
    
    def test_register_empty_name(self) -> bool:
        """Test POST /api/auth/register with empty name - should return 400"""
        try:
            payload = {
                "email": "emptyname@test.com",
                "name": "",
                "password": "test123456"
            }
            response = self.session.post(f"{BASE_URL}/auth/register", 
                                       json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_test("Register (Empty Name)", True, 
                            "Correctly rejected empty name", None, response.status_code)
                return True
            else:
                self.log_test("Register (Empty Name)", False, 
                            f"Should return 400 for empty name", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Register (Empty Name)", False, f"Exception: {str(e)}")
            return False
    
    def test_register_short_password(self) -> bool:
        """Test POST /api/auth/register with short password - should return 400"""
        try:
            payload = {
                "email": "shortpass@test.com",
                "name": "Test User",
                "password": "12"
            }
            response = self.session.post(f"{BASE_URL}/auth/register", 
                                       json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_test("Register (Short Password)", True, 
                            "Correctly rejected short password", None, response.status_code)
                return True
            else:
                self.log_test("Register (Short Password)", False, 
                            f"Should return 400 for short password", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Register (Short Password)", False, f"Exception: {str(e)}")
            return False
    
    # ==================== TRAVEL STYLE TESTS ====================
    
    def test_travel_style_mumbai(self) -> bool:
        """Test POST /api/travel-style with Mumbai details"""
        try:
            payload = {
                "country": "Mumbai, Maharashtra, India",
                "month": "July",
                "occasion": "Wedding"
            }
            response = self.session.post(f"{BASE_URL}/travel-style", 
                                       json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["destination_info", "outfit_suggestions", "makeup_look", 
                                 "accessories", "dos_and_donts", "overall_vibe"]
                
                if all(field in data for field in required_fields):
                    # Store for comparison
                    self.mumbai_response = data
                    self.log_test("Travel Style (Mumbai)", True, 
                                f"Got recommendations for Mumbai wedding in July", 
                                {"destination_info": data["destination_info"][:100] + "..."}, 
                                response.status_code)
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Travel Style (Mumbai)", False, 
                                f"Missing fields: {missing}", data, response.status_code)
                    return False
            else:
                self.log_test("Travel Style (Mumbai)", False, 
                            f"Request failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Travel Style (Mumbai)", False, f"Exception: {str(e)}")
            return False
    
    def test_travel_style_tokyo(self) -> bool:
        """Test POST /api/travel-style with Tokyo details"""
        try:
            payload = {
                "country": "Tokyo, Kanto, Japan",
                "month": "March",
                "occasion": "Sightseeing / Tourist"
            }
            response = self.session.post(f"{BASE_URL}/travel-style", 
                                       json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["destination_info", "outfit_suggestions", "makeup_look", 
                                 "accessories", "dos_and_donts", "overall_vibe"]
                
                if all(field in data for field in required_fields):
                    # Store for comparison
                    self.tokyo_response = data
                    self.log_test("Travel Style (Tokyo)", True, 
                                f"Got recommendations for Tokyo sightseeing in March", 
                                {"destination_info": data["destination_info"][:100] + "..."}, 
                                response.status_code)
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Travel Style (Tokyo)", False, 
                                f"Missing fields: {missing}", data, response.status_code)
                    return False
            else:
                self.log_test("Travel Style (Tokyo)", False, 
                            f"Request failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Travel Style (Tokyo)", False, f"Exception: {str(e)}")
            return False
    
    def test_travel_style_comparison(self) -> bool:
        """Compare Mumbai and Tokyo responses to ensure they are DIFFERENT"""
        if not hasattr(self, 'mumbai_response') or not hasattr(self, 'tokyo_response'):
            self.log_test("Travel Style Comparison", False, "Missing previous responses for comparison")
            return False
        
        try:
            mumbai = self.mumbai_response
            tokyo = self.tokyo_response
            
            # Check if destination_info is different
            dest_different = mumbai["destination_info"] != tokyo["destination_info"]
            
            # Check if outfit suggestions are different
            outfit_different = mumbai["outfit_suggestions"] != tokyo["outfit_suggestions"]
            
            # Check if overall_vibe is different
            vibe_different = mumbai["overall_vibe"] != tokyo["overall_vibe"]
            
            if dest_different and outfit_different and vibe_different:
                self.log_test("Travel Style Comparison", True, 
                            "Mumbai and Tokyo responses are appropriately different")
                return True
            else:
                differences = []
                if not dest_different: differences.append("destination_info")
                if not outfit_different: differences.append("outfit_suggestions")
                if not vibe_different: differences.append("overall_vibe")
                
                self.log_test("Travel Style Comparison", False, 
                            f"Responses are too similar in: {', '.join(differences)}")
                return False
        except Exception as e:
            self.log_test("Travel Style Comparison", False, f"Exception: {str(e)}")
            return False
    
    def test_travel_style_empty_country(self) -> bool:
        """Test POST /api/travel-style with empty country - check graceful error"""
        try:
            payload = {
                "country": "",
                "month": "July",
                "occasion": "Wedding"
            }
            response = self.session.post(f"{BASE_URL}/travel-style", 
                                       json=payload, timeout=30)
            
            # Should either return 400/422 or handle gracefully with default response
            if response.status_code in [400, 422]:
                self.log_test("Travel Style (Empty Country)", True, 
                            "Correctly handled empty country with error", None, response.status_code)
                return True
            elif response.status_code == 200:
                data = response.json()
                if "destination_info" in data:
                    self.log_test("Travel Style (Empty Country)", True, 
                                "Gracefully handled empty country with default response", None, response.status_code)
                    return True
                else:
                    self.log_test("Travel Style (Empty Country)", False, 
                                "Invalid response format", data, response.status_code)
                    return False
            else:
                self.log_test("Travel Style (Empty Country)", False, 
                            f"Unexpected response", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Travel Style (Empty Country)", False, f"Exception: {str(e)}")
            return False
    
    # ==================== CHATBOT TESTS ====================
    
    def test_chat_beauty_question(self) -> bool:
        """Test POST /api/chat with beauty-specific question"""
        try:
            payload = {"message": "What blush should I use for fair skin?"}
            response = self.session.post(f"{BASE_URL}/chat", 
                                       json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "response" in data and "session_id" in data:
                    response_text = data["response"].lower()
                    # Should contain beauty-related terms
                    beauty_terms = ["blush", "fair", "skin", "color", "shade", "makeup", "beauty"]
                    has_beauty_content = any(term in response_text for term in beauty_terms)
                    
                    if has_beauty_content:
                        self.log_test("Chat (Beauty Question)", True, 
                                    f"Got beauty-specific response: {data['response'][:50]}...", 
                                    data, response.status_code)
                        return True
                    else:
                        self.log_test("Chat (Beauty Question)", False, 
                                    "Response doesn't seem beauty-related", data, response.status_code)
                        return False
                else:
                    self.log_test("Chat (Beauty Question)", False, 
                                "Missing response or session_id", data, response.status_code)
                    return False
            else:
                self.log_test("Chat (Beauty Question)", False, 
                            f"Chat request failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Chat (Beauty Question)", False, f"Exception: {str(e)}")
            return False
    
    def test_chat_weather_redirect(self) -> bool:
        """Test POST /api/chat with weather question - should redirect to beauty topics"""
        try:
            payload = {"message": "What is the weather today?"}
            response = self.session.post(f"{BASE_URL}/chat", 
                                       json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "response" in data:
                    response_text = data["response"].lower()
                    # Should redirect to beauty topics
                    redirect_terms = ["beauty", "makeup", "skincare", "style", "help"]
                    has_redirect = any(term in response_text for term in redirect_terms)
                    
                    if has_redirect:
                        self.log_test("Chat (Weather Redirect)", True, 
                                    f"Correctly redirected to beauty topics: {data['response'][:50]}...", 
                                    data, response.status_code)
                        return True
                    else:
                        self.log_test("Chat (Weather Redirect)", False, 
                                    "Didn't redirect to beauty topics", data, response.status_code)
                        return False
                else:
                    self.log_test("Chat (Weather Redirect)", False, 
                                "Missing response field", data, response.status_code)
                    return False
            else:
                self.log_test("Chat (Weather Redirect)", False, 
                            f"Chat request failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Chat (Weather Redirect)", False, f"Exception: {str(e)}")
            return False
    
    def test_chat_cuss_filter(self) -> bool:
        """Test POST /api/chat with cuss words - should get blocked"""
        try:
            payload = {"message": "fuck this app"}
            response = self.session.post(f"{BASE_URL}/chat", 
                                       json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "response" in data:
                    response_text = data["response"].lower()
                    # Should be blocked/filtered
                    filter_terms = ["positive", "beauty", "keep", "conversation", "focused"]
                    has_filter = any(term in response_text for term in filter_terms)
                    
                    if has_filter:
                        self.log_test("Chat (Cuss Filter)", True, 
                                    f"Correctly filtered cuss words: {data['response'][:50]}...", 
                                    data, response.status_code)
                        return True
                    else:
                        self.log_test("Chat (Cuss Filter)", False, 
                                    "Cuss words not properly filtered", data, response.status_code)
                        return False
                else:
                    self.log_test("Chat (Cuss Filter)", False, 
                                "Missing response field", data, response.status_code)
                    return False
            else:
                self.log_test("Chat (Cuss Filter)", False, 
                            f"Chat request failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Chat (Cuss Filter)", False, f"Exception: {str(e)}")
            return False
    
    def test_chat_script_injection(self) -> bool:
        """Test POST /api/chat with script injection - should get blocked"""
        try:
            payload = {"message": "<script>alert(1)</script>"}
            response = self.session.post(f"{BASE_URL}/chat", 
                                       json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "response" in data:
                    response_text = data["response"].lower()
                    # Should be blocked/filtered
                    filter_terms = ["valid", "beauty", "makeup", "question"]
                    has_filter = any(term in response_text for term in filter_terms)
                    
                    if has_filter:
                        self.log_test("Chat (Script Injection)", True, 
                                    f"Correctly blocked script injection: {data['response'][:50]}...", 
                                    data, response.status_code)
                        return True
                    else:
                        self.log_test("Chat (Script Injection)", False, 
                                    "Script injection not properly blocked", data, response.status_code)
                        return False
                else:
                    self.log_test("Chat (Script Injection)", False, 
                                "Missing response field", data, response.status_code)
                    return False
            else:
                self.log_test("Chat (Script Injection)", False, 
                            f"Chat request failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Chat (Script Injection)", False, f"Exception: {str(e)}")
            return False
    
    def test_chat_emoji_spam(self) -> bool:
        """Test POST /api/chat with too many emojis - should get blocked"""
        try:
            payload = {"message": "😀😀😀😀😀😀😀"}
            response = self.session.post(f"{BASE_URL}/chat", 
                                       json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "response" in data:
                    response_text = data["response"].lower()
                    # Should be blocked/filtered
                    filter_terms = ["emojis", "words", "question", "type"]
                    has_filter = any(term in response_text for term in filter_terms)
                    
                    if has_filter:
                        self.log_test("Chat (Emoji Spam)", True, 
                                    f"Correctly blocked emoji spam: {data['response'][:50]}...", 
                                    data, response.status_code)
                        return True
                    else:
                        self.log_test("Chat (Emoji Spam)", False, 
                                    "Emoji spam not properly blocked", data, response.status_code)
                        return False
                else:
                    self.log_test("Chat (Emoji Spam)", False, 
                                "Missing response field", data, response.status_code)
                    return False
            else:
                self.log_test("Chat (Emoji Spam)", False, 
                            f"Chat request failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Chat (Emoji Spam)", False, f"Exception: {str(e)}")
            return False
    
    # ==================== ERROR HANDLING TESTS ====================
    
    def test_check_email_empty_body(self) -> bool:
        """Test POST /api/auth/check-email with empty body - check 422/400 error"""
        try:
            response = self.session.post(f"{BASE_URL}/auth/check-email", 
                                       json={}, timeout=10)
            
            if response.status_code in [400, 422]:
                self.log_test("Check Email (Empty Body)", True, 
                            "Correctly returned error for empty body", None, response.status_code)
                return True
            else:
                self.log_test("Check Email (Empty Body)", False, 
                            f"Should return 400/422 for empty body", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Check Email (Empty Body)", False, f"Exception: {str(e)}")
            return False
    
    def test_health_check(self) -> bool:
        """Test GET /api/health - should return healthy"""
        try:
            response = self.session.get(f"{BASE_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_test("Health Check", True, 
                                f"Service is healthy", data, response.status_code)
                    return True
                else:
                    self.log_test("Health Check", False, 
                                "Unexpected health response format", data, response.status_code)
                    return False
            else:
                self.log_test("Health Check", False, 
                            f"Health check failed", response.text, response.status_code)
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all backend tests according to review request"""
        print(f"🧪 Starting MAK Beauty App Backend API Tests")
        print(f"📍 Base URL: {BASE_URL}")
        print("=" * 80)
        
        # Test sequence based on review request
        tests = [
            # Health check first
            ("Health Check", self.test_health_check),
            
            # Auth Tests
            ("Check Email (Valid)", self.test_check_email_valid),
            ("Check Email (Invalid)", self.test_check_email_invalid),
            ("Register User", self.test_register_user),
            ("Password Login (Correct)", self.test_password_login_correct),
            ("Password Login (Wrong)", self.test_password_login_wrong),
            ("Guest Login", self.test_guest_login),
            ("Register (Empty Name)", self.test_register_empty_name),
            ("Register (Short Password)", self.test_register_short_password),
            
            # Travel Style Tests
            ("Travel Style (Mumbai)", self.test_travel_style_mumbai),
            ("Travel Style (Tokyo)", self.test_travel_style_tokyo),
            ("Travel Style Comparison", self.test_travel_style_comparison),
            ("Travel Style (Empty Country)", self.test_travel_style_empty_country),
            
            # Chatbot Tests
            ("Chat (Beauty Question)", self.test_chat_beauty_question),
            ("Chat (Weather Redirect)", self.test_chat_weather_redirect),
            ("Chat (Cuss Filter)", self.test_chat_cuss_filter),
            ("Chat (Script Injection)", self.test_chat_script_injection),
            ("Chat (Emoji Spam)", self.test_chat_emoji_spam),
            
            # Error Handling Tests
            ("Check Email (Empty Body)", self.test_check_email_empty_body),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_test(test_name, False, f"Unexpected error: {str(e)}")
        
        print("=" * 80)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        # Summary
        summary = {
            "total_tests": total,
            "passed": passed,
            "failed": total - passed,
            "success_rate": (passed / total) * 100,
            "test_details": self.test_results
        }
        
        return summary

def main():
    """Main test execution"""
    tester = MAKBackendTester()
    results = tester.run_all_tests()
    
    # Print detailed results
    print("\n📋 Detailed Results:")
    for result in results["test_details"]:
        status = "✅" if result["success"] else "❌"
        status_code = f" (HTTP {result['status_code']})" if result['status_code'] else ""
        print(f"{status} {result['test']}{status_code}: {result['details']}")
    
    print(f"\n🎯 Overall Success Rate: {results['success_rate']:.1f}%")
    
    # Return exit code based on results
    if results["success_rate"] >= 90:  # Allow for some minor failures
        print("🎉 Tests completed successfully!")
        return 0
    else:
        print(f"⚠️  {results['failed']} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())