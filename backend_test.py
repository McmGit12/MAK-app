#!/usr/bin/env python3
"""
Backend Test Script for MAK App Password Change Flow
Tests the complete password change functionality as requested
"""

import requests
import json
import sys
from datetime import datetime

# Use the production URL from frontend/.env
BASE_URL = "https://complexion-fit.preview.emergentagent.com/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_password_change_flow():
    """Test the complete password change flow"""
    print("=" * 60)
    print("TESTING PASSWORD CHANGE FLOW")
    print("=" * 60)
    
    test_results = []
    user_id = None
    
    # Test 1: Register a test user
    print("1. REGISTERING TEST USER")
    register_data = {
        "email": "pw-test@mak.com",
        "name": "PW Tester",
        "password": "oldpass123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data, timeout=10)
        if response.status_code == 200:
            user_data = response.json()
            user_id = user_data.get("id")
            log_test("Register test user", "PASS", f"User ID: {user_id}")
            test_results.append(("Register test user", "PASS", response.status_code))
        else:
            log_test("Register test user", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Register test user", "FAIL", response.status_code))
            return test_results
    except Exception as e:
        log_test("Register test user", "FAIL", f"Exception: {str(e)}")
        test_results.append(("Register test user", "FAIL", "Exception"))
        return test_results
    
    # Test 2: Change password with CORRECT current password
    print("2. CHANGING PASSWORD WITH CORRECT CURRENT PASSWORD")
    change_data = {
        "user_id": user_id,
        "current_password": "oldpass123",
        "new_password": "newpass456"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/change-password", json=change_data, timeout=10)
        if response.status_code == 200:
            log_test("Change password (correct current)", "PASS", f"Response: {response.json()}")
            test_results.append(("Change password (correct current)", "PASS", response.status_code))
        else:
            log_test("Change password (correct current)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Change password (correct current)", "FAIL", response.status_code))
    except Exception as e:
        log_test("Change password (correct current)", "FAIL", f"Exception: {str(e)}")
        test_results.append(("Change password (correct current)", "FAIL", "Exception"))
    
    # Test 3: Try login with OLD password (should FAIL)
    print("3. TRYING LOGIN WITH OLD PASSWORD (should fail)")
    old_login_data = {
        "email": "pw-test@mak.com",
        "password": "oldpass123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/password-login", json=old_login_data, timeout=10)
        if response.status_code == 400:
            log_test("Login with old password (should fail)", "PASS", f"Correctly rejected with 400: {response.json()}")
            test_results.append(("Login with old password (should fail)", "PASS", response.status_code))
        else:
            log_test("Login with old password (should fail)", "FAIL", f"Expected 400, got {response.status_code}: {response.text}")
            test_results.append(("Login with old password (should fail)", "FAIL", response.status_code))
    except Exception as e:
        log_test("Login with old password (should fail)", "FAIL", f"Exception: {str(e)}")
        test_results.append(("Login with old password (should fail)", "FAIL", "Exception"))
    
    # Test 4: Try login with NEW password (should SUCCEED)
    print("4. TRYING LOGIN WITH NEW PASSWORD (should succeed)")
    new_login_data = {
        "email": "pw-test@mak.com",
        "password": "newpass456"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/password-login", json=new_login_data, timeout=10)
        if response.status_code == 200:
            log_test("Login with new password (should succeed)", "PASS", f"Successfully logged in: {response.json()}")
            test_results.append(("Login with new password (should succeed)", "PASS", response.status_code))
        else:
            log_test("Login with new password (should succeed)", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            test_results.append(("Login with new password (should succeed)", "FAIL", response.status_code))
    except Exception as e:
        log_test("Login with new password (should succeed)", "FAIL", f"Exception: {str(e)}")
        test_results.append(("Login with new password (should succeed)", "FAIL", "Exception"))
    
    # Test 5: Try change password with WRONG current password
    print("5. TRYING TO CHANGE PASSWORD WITH WRONG CURRENT PASSWORD")
    wrong_current_data = {
        "user_id": user_id,
        "current_password": "wrongpass",
        "new_password": "another123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/change-password", json=wrong_current_data, timeout=10)
        if response.status_code == 400:
            log_test("Change password (wrong current)", "PASS", f"Correctly rejected with 400: {response.json()}")
            test_results.append(("Change password (wrong current)", "PASS", response.status_code))
        else:
            log_test("Change password (wrong current)", "FAIL", f"Expected 400, got {response.status_code}: {response.text}")
            test_results.append(("Change password (wrong current)", "FAIL", response.status_code))
    except Exception as e:
        log_test("Change password (wrong current)", "FAIL", f"Exception: {str(e)}")
        test_results.append(("Change password (wrong current)", "FAIL", "Exception"))
    
    # Test 6: Try change password with too SHORT new password
    print("6. TRYING TO CHANGE PASSWORD WITH TOO SHORT NEW PASSWORD")
    short_password_data = {
        "user_id": user_id,
        "current_password": "newpass456",
        "new_password": "ab"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/change-password", json=short_password_data, timeout=10)
        if response.status_code == 400:
            log_test("Change password (too short)", "PASS", f"Correctly rejected with 400: {response.json()}")
            test_results.append(("Change password (too short)", "PASS", response.status_code))
        else:
            log_test("Change password (too short)", "FAIL", f"Expected 400, got {response.status_code}: {response.text}")
            test_results.append(("Change password (too short)", "FAIL", response.status_code))
    except Exception as e:
        log_test("Change password (too short)", "FAIL", f"Exception: {str(e)}")
        test_results.append(("Change password (too short)", "FAIL", "Exception"))
    
    # Test 7: Try change password with SAME old and new
    print("7. TRYING TO CHANGE PASSWORD WITH SAME OLD AND NEW PASSWORD")
    same_password_data = {
        "user_id": user_id,
        "current_password": "newpass456",
        "new_password": "newpass456"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/change-password", json=same_password_data, timeout=10)
        if response.status_code == 400:
            log_test("Change password (same old/new)", "PASS", f"Correctly rejected with 400: {response.json()}")
            test_results.append(("Change password (same old/new)", "PASS", response.status_code))
        else:
            log_test("Change password (same old/new)", "FAIL", f"Expected 400, got {response.status_code}: {response.text}")
            test_results.append(("Change password (same old/new)", "FAIL", response.status_code))
    except Exception as e:
        log_test("Change password (same old/new)", "FAIL", f"Exception: {str(e)}")
        test_results.append(("Change password (same old/new)", "FAIL", "Exception"))
    
    return test_results

def main():
    """Main test execution"""
    print("MAK App Backend Password Change Flow Testing")
    print(f"Testing against: {BASE_URL}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test password change flow
    results = test_password_change_flow()
    
    # Summary
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, status, _ in results if status == "PASS")
    total = len(results)
    
    for test_name, status, status_code in results:
        status_symbol = "✅" if status == "PASS" else "❌"
        print(f"{status_symbol} {test_name} (HTTP {status_code})")
    
    print()
    print(f"OVERALL: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Password change flow working correctly!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - Password change flow has issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())