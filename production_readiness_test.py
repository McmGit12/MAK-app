#!/usr/bin/env python3
"""
Production Readiness Test for MAK App Backend
Testing the specific production-readiness fixes as requested in the review.
"""

import requests
import json
import time
import sys
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Backend URL - using localhost due to external URL timeout issues
BASE_URL = "http://localhost:8001/api"

def test_health_check():
    """Test 1: Health Check with MongoDB verification"""
    print("\n1️⃣ Testing Health Check with MongoDB verification...")
    
    try:
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/health", timeout=30)
        end_time = time.time()
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response Time: {(end_time - start_time):.2f}s")
        
        if response.status_code == 200:
            health_data = response.json()
            print(f"   Response: {json.dumps(health_data, indent=2)}")
            
            # Check for required fields
            mongodb_status = health_data.get("mongodb")
            overall_status = health_data.get("status")
            
            if mongodb_status == "connected" and overall_status == "healthy":
                print(f"   ✅ Health check passed - MongoDB connected and status healthy")
                return ("Health Check", "PASS", response.status_code, f"{(end_time - start_time):.2f}s")
            else:
                print(f"   ❌ Health check failed - MongoDB: {mongodb_status}, Status: {overall_status}")
                return ("Health Check", "FAIL", response.status_code, f"{(end_time - start_time):.2f}s")
        else:
            print(f"   ❌ Health check failed: {response.status_code} - {response.text}")
            return ("Health Check", "FAIL", response.status_code, f"{(end_time - start_time):.2f}s")
            
    except Exception as e:
        print(f"   ❌ Health check error: {str(e)}")
        return ("Health Check", "FAIL", "Exception", "N/A")

def test_single_email_check(email):
    """Helper function to test a single email check"""
    try:
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/auth/check-email", 
                               json={"email": email}, 
                               timeout=10)
        end_time = time.time()
        return {
            "email": email,
            "status_code": response.status_code,
            "response_time": end_time - start_time,
            "success": response.status_code == 200
        }
    except Exception as e:
        return {
            "email": email,
            "status_code": "Exception",
            "response_time": None,
            "success": False,
            "error": str(e)
        }

def test_connection_pooling():
    """Test 2: Connection pooling test - rapid sequential requests"""
    print("\n2️⃣ Testing Connection pooling - rapid sequential requests...")
    
    emails = [
        "test1@pool.com",
        "test2@pool.com", 
        "test3@pool.com",
        "test4@pool.com",
        "test5@pool.com"
    ]
    
    start_time = time.time()
    
    # Use ThreadPoolExecutor for concurrent requests
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(test_single_email_check, email) for email in emails]
        results = []
        
        for future in as_completed(futures):
            results.append(future.result())
    
    end_time = time.time()
    total_time = end_time - start_time
    
    print(f"   Total Time for 5 requests: {total_time:.2f}s")
    
    # Check results
    successful_requests = sum(1 for r in results if r["success"])
    all_within_time = total_time <= 5.0
    
    for result in results:
        status = "✅" if result["success"] else "❌"
        time_str = f"{result['response_time']:.2f}s" if result["response_time"] else "N/A"
        print(f"   {status} {result['email']}: {result['status_code']} ({time_str})")
    
    if successful_requests == 5 and all_within_time:
        print(f"   ✅ Connection pooling test passed - All 5 requests successful within 5s")
        return ("Connection Pooling", "PASS", "200", f"{total_time:.2f}s")
    elif successful_requests == 5:
        print(f"   ⚠️ All requests successful but took {total_time:.2f}s (>5s)")
        return ("Connection Pooling", "PARTIAL", "200", f"{total_time:.2f}s")
    else:
        print(f"   ❌ Connection pooling test failed - Only {successful_requests}/5 successful")
        return ("Connection Pooling", "FAIL", "Mixed", f"{total_time:.2f}s")

def test_auth_flow():
    """Test 3: Auth flow - complete cycle"""
    print("\n3️⃣ Testing Complete Auth Flow...")
    
    test_email = "prod-ready@mak.com"
    test_name = "Prod User"
    test_password = "test123456"
    
    results = []
    
    # Step 1: Register user
    print("   Step 1: User Registration...")
    try:
        start_time = time.time()
        register_data = {
            "email": test_email,
            "name": test_name,
            "password": test_password
        }
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data, timeout=30)
        end_time = time.time()
        
        print(f"   Registration Status: {response.status_code} ({(end_time - start_time):.2f}s)")
        
        if response.status_code == 200:
            print(f"   ✅ Registration successful")
            results.append(("Registration", "PASS", response.status_code, f"{(end_time - start_time):.2f}s"))
        elif response.status_code == 400 and "already exists" in response.text:
            print(f"   ℹ️ User already exists (expected for repeat tests)")
            results.append(("Registration", "PASS", response.status_code, f"{(end_time - start_time):.2f}s"))
        else:
            print(f"   ❌ Registration failed: {response.text}")
            results.append(("Registration", "FAIL", response.status_code, f"{(end_time - start_time):.2f}s"))
            return results
            
    except Exception as e:
        print(f"   ❌ Registration error: {str(e)}")
        results.append(("Registration", "FAIL", "Exception", "N/A"))
        return results
    
    # Step 2: Password login
    print("   Step 2: Password Login...")
    try:
        start_time = time.time()
        login_data = {
            "email": test_email,
            "password": test_password
        }
        response = requests.post(f"{BASE_URL}/auth/password-login", json=login_data, timeout=30)
        end_time = time.time()
        
        print(f"   Login Status: {response.status_code} ({(end_time - start_time):.2f}s)")
        
        if response.status_code == 200:
            user_data = response.json()
            print(f"   ✅ Login successful - User ID: {user_data.get('id', 'No ID')}")
            results.append(("Password Login", "PASS", response.status_code, f"{(end_time - start_time):.2f}s"))
        else:
            print(f"   ❌ Login failed: {response.text}")
            results.append(("Password Login", "FAIL", response.status_code, f"{(end_time - start_time):.2f}s"))
            return results
            
    except Exception as e:
        print(f"   ❌ Login error: {str(e)}")
        results.append(("Password Login", "FAIL", "Exception", "N/A"))
        return results
    
    # Step 3: Check email exists
    print("   Step 3: Email Check...")
    try:
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/auth/check-email", 
                               json={"email": test_email}, 
                               timeout=30)
        end_time = time.time()
        
        print(f"   Email Check Status: {response.status_code} ({(end_time - start_time):.2f}s)")
        
        if response.status_code == 200:
            email_data = response.json()
            exists = email_data.get("exists", False)
            print(f"   Email exists: {exists}")
            
            if exists:
                print(f"   ✅ Email check successful - User exists")
                results.append(("Email Check", "PASS", response.status_code, f"{(end_time - start_time):.2f}s"))
            else:
                print(f"   ❌ Email check failed - User should exist")
                results.append(("Email Check", "FAIL", response.status_code, f"{(end_time - start_time):.2f}s"))
        else:
            print(f"   ❌ Email check failed: {response.text}")
            results.append(("Email Check", "FAIL", response.status_code, f"{(end_time - start_time):.2f}s"))
            
    except Exception as e:
        print(f"   ❌ Email check error: {str(e)}")
        results.append(("Email Check", "FAIL", "Exception", "N/A"))
    
    return results

def test_chat_timeout():
    """Test 4: Chat with timeout protection"""
    print("\n4️⃣ Testing Chat with timeout protection...")
    
    try:
        start_time = time.time()
        chat_data = {
            "message": "What blush suits warm skin?"
        }
        response = requests.post(f"{BASE_URL}/chat", json=chat_data, timeout=20)
        end_time = time.time()
        
        response_time = end_time - start_time
        print(f"   Status Code: {response.status_code}")
        print(f"   Response Time: {response_time:.2f}s")
        
        if response.status_code == 200:
            chat_response = response.json()
            message = chat_response.get("response", "")
            print(f"   Response length: {len(message)} characters")
            print(f"   Response preview: {message[:100]}...")
            
            if response_time <= 20:
                print(f"   ✅ Chat successful within 20s timeout")
                return ("Chat Timeout", "PASS", response.status_code, f"{response_time:.2f}s")
            else:
                print(f"   ⚠️ Chat successful but took {response_time:.2f}s (>20s)")
                return ("Chat Timeout", "PARTIAL", response.status_code, f"{response_time:.2f}s")
        else:
            print(f"   ❌ Chat failed: {response.status_code} - {response.text}")
            return ("Chat Timeout", "FAIL", response.status_code, f"{response_time:.2f}s")
            
    except requests.exceptions.Timeout:
        print(f"   ❌ Chat timed out after 20s")
        return ("Chat Timeout", "FAIL", "Timeout", ">20s")
    except Exception as e:
        print(f"   ❌ Chat error: {str(e)}")
        return ("Chat Timeout", "FAIL", "Exception", "N/A")

def test_error_handling():
    """Test 5: Error handling"""
    print("\n5️⃣ Testing Error handling...")
    
    results = []
    
    # Test 1: Invalid login
    print("   Test 5a: Invalid login...")
    try:
        start_time = time.time()
        login_data = {
            "email": "nonexist@test.com",
            "password": "x"
        }
        response = requests.post(f"{BASE_URL}/auth/password-login", json=login_data, timeout=30)
        end_time = time.time()
        
        print(f"   Invalid Login Status: {response.status_code} ({(end_time - start_time):.2f}s)")
        
        if response.status_code == 400:
            error_data = response.json()
            print(f"   ✅ Graceful 400 error returned")
            print(f"   Error message: {error_data}")
            results.append(("Invalid Login Error", "PASS", response.status_code, f"{(end_time - start_time):.2f}s"))
        else:
            print(f"   ❌ Expected 400 error, got: {response.status_code}")
            results.append(("Invalid Login Error", "FAIL", response.status_code, f"{(end_time - start_time):.2f}s"))
            
    except Exception as e:
        print(f"   ❌ Invalid login test error: {str(e)}")
        results.append(("Invalid Login Error", "FAIL", "Exception", "N/A"))
    
    # Test 2: Invalid registration
    print("   Test 5b: Invalid registration...")
    try:
        start_time = time.time()
        register_data = {
            "email": "bad",
            "name": "",
            "password": "1"
        }
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data, timeout=30)
        end_time = time.time()
        
        print(f"   Invalid Registration Status: {response.status_code} ({(end_time - start_time):.2f}s)")
        
        if response.status_code == 400:
            error_data = response.json()
            print(f"   ✅ Validation errors returned")
            print(f"   Error details: {error_data}")
            results.append(("Invalid Registration Error", "PASS", response.status_code, f"{(end_time - start_time):.2f}s"))
        else:
            print(f"   ❌ Expected 400 validation error, got: {response.status_code}")
            results.append(("Invalid Registration Error", "FAIL", response.status_code, f"{(end_time - start_time):.2f}s"))
            
    except Exception as e:
        print(f"   ❌ Invalid registration test error: {str(e)}")
        results.append(("Invalid Registration Error", "FAIL", "Exception", "N/A"))
    
    return results

def main():
    """Main test execution"""
    print("MAK App Backend Production Readiness Testing")
    print(f"Testing against: {BASE_URL}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    all_results = []
    
    # Test 1: Health Check
    result = test_health_check()
    all_results.append(result)
    
    # Test 2: Connection Pooling
    result = test_connection_pooling()
    all_results.append(result)
    
    # Test 3: Auth Flow
    auth_results = test_auth_flow()
    all_results.extend(auth_results)
    
    # Test 4: Chat Timeout
    result = test_chat_timeout()
    all_results.append(result)
    
    # Test 5: Error Handling
    error_results = test_error_handling()
    all_results.extend(error_results)
    
    # Summary
    print("\n" + "=" * 80)
    print("🏁 Production Readiness Testing Complete")
    print("=" * 80)
    
    passed = sum(1 for _, status, _, _ in all_results if status == "PASS")
    partial = sum(1 for _, status, _, _ in all_results if status == "PARTIAL")
    total = len(all_results)
    
    print("\nDetailed Results:")
    for test_name, status, status_code, timing in all_results:
        if status == "PASS":
            status_symbol = "✅"
        elif status == "PARTIAL":
            status_symbol = "⚠️"
        else:
            status_symbol = "❌"
        print(f"{status_symbol} {test_name}: {status_code} ({timing})")
    
    print(f"\nOVERALL: {passed}/{total} tests passed, {partial} partial ({((passed+partial)/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Backend is production ready!")
        return 0
    elif passed + partial == total:
        print("⚠️  ALL TESTS PASSED/PARTIAL - Backend mostly production ready")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - Backend needs fixes before production")
        return 1

if __name__ == "__main__":
    sys.exit(main())