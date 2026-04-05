#!/usr/bin/env python3
"""
ComplexionFit Backend API Testing Script
Tests all backend endpoints according to test_result.md requirements
"""

import requests
import json
import base64
import sys
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://complexion-fit.preview.emergentagent.com/api"
TEST_EMAIL = "test@example.com"
TEST_PHONE = "+1234567890"

class ComplexionFitTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_user_id = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    def test_health_check(self) -> bool:
        """Test GET /api/health endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "status" in data and data["status"] == "healthy":
                    self.log_test("Health Check", True, f"Status: {data['status']}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected response format", data)
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_email_login(self) -> bool:
        """Test POST /api/auth/email-login endpoint"""
        try:
            payload = {"email": TEST_EMAIL}
            response = self.session.post(f"{BASE_URL}/auth/email-login", 
                                       json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "user_hash", "login_method", "created_at"]
                
                if all(field in data for field in required_fields):
                    self.test_user_id = data["id"]  # Store for later tests
                    self.log_test("Email Login", True, 
                                f"User created/retrieved: {data['id'][:8]}...", data)
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Email Login", False, 
                                f"Missing fields: {missing}", data)
                    return False
            else:
                self.log_test("Email Login", False, 
                            f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Email Login", False, f"Exception: {str(e)}")
            return False
    
    def test_otp_flow(self) -> bool:
        """Test OTP request and verification flow"""
        try:
            # Step 1: Request OTP
            payload = {"phone": TEST_PHONE}
            response = self.session.post(f"{BASE_URL}/auth/request-otp", 
                                       json=payload, timeout=10)
            
            if response.status_code != 200:
                self.log_test("OTP Request", False, 
                            f"HTTP {response.status_code}", response.text)
                return False
            
            otp_data = response.json()
            if "demo_otp" not in otp_data:
                self.log_test("OTP Request", False, 
                            "No demo_otp in response", otp_data)
                return False
            
            demo_otp = otp_data["demo_otp"]
            self.log_test("OTP Request", True, 
                        f"OTP received: {demo_otp}", otp_data)
            
            # Step 2: Verify OTP
            verify_payload = {"phone": TEST_PHONE, "otp": demo_otp}
            verify_response = self.session.post(f"{BASE_URL}/auth/verify-otp", 
                                              json=verify_payload, timeout=10)
            
            if verify_response.status_code == 200:
                verify_data = verify_response.json()
                required_fields = ["id", "user_hash", "login_method", "created_at"]
                
                if all(field in verify_data for field in required_fields):
                    self.log_test("OTP Verification", True, 
                                f"User verified: {verify_data['id'][:8]}...", verify_data)
                    return True
                else:
                    missing = [f for f in required_fields if f not in verify_data]
                    self.log_test("OTP Verification", False, 
                                f"Missing fields: {missing}", verify_data)
                    return False
            else:
                self.log_test("OTP Verification", False, 
                            f"HTTP {verify_response.status_code}", verify_response.text)
                return False
                
        except Exception as e:
            self.log_test("OTP Flow", False, f"Exception: {str(e)}")
            return False
    
    def test_curated_recommendations(self) -> bool:
        """Test GET /api/curated-recommendations endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/curated-recommendations", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    # Check first recommendation has required fields
                    first_rec = data[0]
                    required_fields = ["id", "category", "product_name", "brand", "description"]
                    
                    if all(field in first_rec for field in required_fields):
                        self.log_test("Curated Recommendations", True, 
                                    f"Retrieved {len(data)} recommendations")
                        return True
                    else:
                        missing = [f for f in required_fields if f not in first_rec]
                        self.log_test("Curated Recommendations", False, 
                                    f"Missing fields in recommendation: {missing}", first_rec)
                        return False
                else:
                    self.log_test("Curated Recommendations", False, 
                                "Empty or invalid response format", data)
                    return False
            else:
                self.log_test("Curated Recommendations", False, 
                            f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Curated Recommendations", False, f"Exception: {str(e)}")
            return False
    
    def test_feedback_submission(self) -> bool:
        """Test POST /api/feedback endpoint"""
        if not self.test_user_id:
            self.log_test("Feedback Submission", False, "No test user ID available")
            return False
        
        try:
            payload = {
                "user_id": self.test_user_id,
                "rating": 5,
                "category": "app_experience",
                "comment": "Great app! Testing feedback submission."
            }
            
            response = self.session.post(f"{BASE_URL}/feedback", 
                                       json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "user_id", "rating", "category", "created_at"]
                
                if all(field in data for field in required_fields):
                    if data["user_id"] == self.test_user_id and data["rating"] == 5:
                        self.log_test("Feedback Submission", True, 
                                    f"Feedback submitted: {data['id'][:8]}...", data)
                        return True
                    else:
                        self.log_test("Feedback Submission", False, 
                                    "Data mismatch in response", data)
                        return False
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Feedback Submission", False, 
                                f"Missing fields: {missing}", data)
                    return False
            else:
                self.log_test("Feedback Submission", False, 
                            f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Feedback Submission", False, f"Exception: {str(e)}")
            return False
    
    def test_user_analyses(self) -> bool:
        """Test GET /api/analyses/{user_id} endpoint"""
        if not self.test_user_id:
            self.log_test("User Analyses", False, "No test user ID available")
            return False
        
        try:
            response = self.session.get(f"{BASE_URL}/analyses/{self.test_user_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Should be empty initially for new user
                    self.log_test("User Analyses", True, 
                                f"Retrieved {len(data)} analyses (expected empty for new user)")
                    return True
                else:
                    self.log_test("User Analyses", False, 
                                "Response is not a list", data)
                    return False
            else:
                self.log_test("User Analyses", False, 
                            f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("User Analyses", False, f"Exception: {str(e)}")
            return False
    
    def test_skin_analysis(self) -> bool:
        """Test POST /api/analyze-skin endpoint with sample image"""
        if not self.test_user_id:
            self.log_test("Skin Analysis", False, "No test user ID available")
            return False
        
        try:
            # Create a simple test image (1x1 pixel PNG in base64)
            # This is a minimal valid PNG image for testing
            test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            
            payload = {
                "user_id": self.test_user_id,
                "image_base64": test_image_b64
            }
            
            response = self.session.post(f"{BASE_URL}/analyze-skin", 
                                       json=payload, timeout=30)  # Longer timeout for AI processing
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "skin_type", "skin_tone", "undertone", 
                                 "face_shape", "skin_concerns", "ai_recommendations"]
                
                if all(field in data for field in required_fields):
                    self.log_test("Skin Analysis", True, 
                                f"Analysis completed: {data['skin_type']}, {data['skin_tone']}")
                    return True
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_test("Skin Analysis", False, 
                                f"Missing fields: {missing}", data)
                    return False
            else:
                self.log_test("Skin Analysis", False, 
                            f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_test("Skin Analysis", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all backend tests"""
        print(f"🧪 Starting ComplexionFit Backend API Tests")
        print(f"📍 Base URL: {BASE_URL}")
        print("=" * 60)
        
        # Test sequence based on dependencies
        tests = [
            ("Health Check", self.test_health_check),
            ("Email Login", self.test_email_login),
            ("OTP Flow", self.test_otp_flow),
            ("Curated Recommendations", self.test_curated_recommendations),
            ("Feedback Submission", self.test_feedback_submission),
            ("User Analyses", self.test_user_analyses),
            ("Skin Analysis", self.test_skin_analysis),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_test(test_name, False, f"Unexpected error: {str(e)}")
        
        print("=" * 60)
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
    tester = ComplexionFitTester()
    results = tester.run_all_tests()
    
    # Print detailed results
    print("\n📋 Detailed Results:")
    for result in results["test_details"]:
        status = "✅" if result["success"] else "❌"
        print(f"{status} {result['test']}: {result['details']}")
    
    print(f"\n🎯 Overall Success Rate: {results['success_rate']:.1f}%")
    
    # Return exit code based on results
    if results["success_rate"] == 100:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {results['failed']} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())