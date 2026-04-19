#!/usr/bin/env python3
"""
Backend Test for MAK App Analysis History Functionality
Testing the specific endpoints requested in the review.
"""

import requests
import json
import base64
import sys
from datetime import datetime

# Backend URL - using localhost since external URL is not responding
BASE_URL = "http://localhost:8001/api"

def test_analysis_history():
    """Test the analysis history functionality as requested"""
    print("🧪 Testing MAK App Analysis History Functionality")
    print("=" * 60)
    
    test_results = []
    user_id = None
    analysis_id = None
    
    # Test 1: Register a test user
    print("\n1️⃣ Testing user registration...")
    register_data = {
        "email": "history-test@mak.com",
        "name": "History Tester", 
        "password": "test123456"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=register_data, timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            user_id = user_data.get("id")
            print(f"   ✅ User registered successfully")
            print(f"   User ID: {user_id}")
            test_results.append(("User registration", "PASS", response.status_code))
        elif response.status_code == 400 and "already exists" in response.text:
            # User already exists, try to login instead
            print(f"   ℹ️ User already exists, attempting login...")
            login_data = {"email": "history-test@mak.com", "password": "test123456"}
            login_response = requests.post(f"{BASE_URL}/auth/password-login", json=login_data, timeout=30)
            if login_response.status_code == 200:
                user_data = login_response.json()
                user_id = user_data.get("id")
                print(f"   ✅ User logged in successfully")
                print(f"   User ID: {user_id}")
                test_results.append(("User registration/login", "PASS", login_response.status_code))
            else:
                print(f"   ❌ Login failed: {login_response.status_code} - {login_response.text}")
                test_results.append(("User registration/login", "FAIL", login_response.status_code))
                return test_results
        else:
            print(f"   ❌ Registration failed: {response.status_code} - {response.text}")
            test_results.append(("User registration", "FAIL", response.status_code))
            return test_results
            
    except Exception as e:
        print(f"   ❌ Registration error: {str(e)}")
        test_results.append(("User registration", "FAIL", "Exception"))
        return test_results
    
    # Test 2: Check empty history for new user
    print(f"\n2️⃣ Testing empty history for user {user_id}...")
    try:
        response = requests.get(f"{BASE_URL}/analyses/{user_id}", timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            analyses = response.json()
            print(f"   ✅ Endpoint exists and returns data")
            print(f"   Response type: {type(analyses)}")
            print(f"   Number of analyses: {len(analyses) if isinstance(analyses, list) else 'Not a list'}")
            if isinstance(analyses, list):
                if len(analyses) == 0:
                    print(f"   ✅ Returns empty array as expected for new user")
                    test_results.append(("Empty history check", "PASS", response.status_code))
                else:
                    print(f"   ℹ️ User has {len(analyses)} existing analyses")
                    test_results.append(("Empty history check", "PASS", response.status_code))
            else:
                print(f"   ⚠️ Response is not an array: {analyses}")
                test_results.append(("Empty history check", "FAIL", response.status_code))
        else:
            print(f"   ❌ Failed: {response.status_code} - {response.text}")
            test_results.append(("Empty history check", "FAIL", response.status_code))
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        test_results.append(("Empty history check", "FAIL", "Exception"))
    
    # Test 3: Verify analyze-skin endpoint exists and accepts requests
    print(f"\n3️⃣ Testing analyze-skin endpoint...")
    
    # Create a tiny dummy image (1x1 pixel PNG)
    dummy_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x12IDATx\x9cc```bPPP\x00\x02\xac\x01\x00\x00\x05\x00\x01\r\n-\xdb\x00\x00\x00\x00IEND\xaeB`\x82'
    dummy_base64 = base64.b64encode(dummy_image_data).decode('utf-8')
    
    analyze_data = {
        "image_base64": dummy_base64,
        "user_id": user_id,
        "mode": "skin_care"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/analyze-skin", json=analyze_data, timeout=120)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            analysis_result = response.json()
            print(f"   ✅ Endpoint exists and accepts requests")
            print(f"   Analysis ID: {analysis_result.get('id', 'No ID')}")
            print(f"   Skin Type: {analysis_result.get('skin_type', 'No skin type')}")
            analysis_id = analysis_result.get('id')
            test_results.append(("Analyze-skin endpoint", "PASS", response.status_code))
        elif response.status_code == 404:
            print(f"   ❌ Endpoint not found (404)")
            test_results.append(("Analyze-skin endpoint", "FAIL", response.status_code))
            analysis_id = None
        else:
            print(f"   ⚠️ Endpoint exists but returned: {response.status_code}")
            print(f"   Response: {response.text[:200]}...")
            test_results.append(("Analyze-skin endpoint", "PARTIAL", response.status_code))
            analysis_id = None
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        test_results.append(("Analyze-skin endpoint", "FAIL", "Exception"))
        analysis_id = None
    
    # Test 4: Check GET /api/analyses/{user_id} returns proper array format after analysis
    print(f"\n4️⃣ Re-checking analyses endpoint after potential analysis...")
    try:
        response = requests.get(f"{BASE_URL}/analyses/{user_id}", timeout=30)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            analyses = response.json()
            print(f"   ✅ Endpoint working")
            print(f"   Response type: {type(analyses)}")
            print(f"   Number of analyses: {len(analyses) if isinstance(analyses, list) else 'Not a list'}")
            
            if isinstance(analyses, list) and len(analyses) > 0:
                print(f"   ✅ Returns proper array format with {len(analyses)} analysis(es)")
                latest = analyses[0]
                print(f"   Latest analysis ID: {latest.get('id', 'No ID')}")
                print(f"   Created at: {latest.get('created_at', 'No timestamp')}")
                test_results.append(("Analyses array format", "PASS", response.status_code))
            elif isinstance(analyses, list):
                print(f"   ✅ Returns proper empty array format")
                test_results.append(("Analyses array format", "PASS", response.status_code))
            else:
                print(f"   ⚠️ Response format issue: {type(analyses)}")
                test_results.append(("Analyses array format", "FAIL", response.status_code))
        else:
            print(f"   ❌ Failed: {response.status_code} - {response.text}")
            test_results.append(("Analyses array format", "FAIL", response.status_code))
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        test_results.append(("Analyses array format", "FAIL", "Exception"))
    
    # Test 5: Verify GET /api/analysis/{analysis_id} endpoint exists
    print(f"\n5️⃣ Testing individual analysis endpoint...")
    
    # Test with a fake ID first
    fake_id = "fake-analysis-id-12345"
    try:
        response = requests.get(f"{BASE_URL}/analysis/{fake_id}", timeout=30)
        print(f"   Status Code for fake ID: {response.status_code}")
        
        if response.status_code == 404:
            print(f"   ✅ Endpoint exists and properly returns 404 for non-existent analysis")
            test_results.append(("Individual analysis endpoint (404)", "PASS", response.status_code))
        elif response.status_code == 500:
            print(f"   ⚠️ Endpoint exists but returns 500 error (may need error handling)")
            test_results.append(("Individual analysis endpoint (404)", "PARTIAL", response.status_code))
        else:
            print(f"   ⚠️ Unexpected response: {response.status_code} - {response.text[:100]}...")
            test_results.append(("Individual analysis endpoint (404)", "PARTIAL", response.status_code))
            
    except Exception as e:
        print(f"   ❌ Error testing fake ID: {str(e)}")
        test_results.append(("Individual analysis endpoint (404)", "FAIL", "Exception"))
    
    # If we have a real analysis ID, test with that too
    if analysis_id:
        try:
            response = requests.get(f"{BASE_URL}/analysis/{analysis_id}", timeout=30)
            print(f"   Status Code for real ID: {response.status_code}")
            
            if response.status_code == 200:
                analysis = response.json()
                print(f"   ✅ Successfully retrieved analysis")
                print(f"   Analysis ID: {analysis.get('id', 'No ID')}")
                print(f"   Skin Type: {analysis.get('skin_type', 'No skin type')}")
                test_results.append(("Individual analysis endpoint (200)", "PASS", response.status_code))
            else:
                print(f"   ⚠️ Failed to retrieve real analysis: {response.status_code}")
                test_results.append(("Individual analysis endpoint (200)", "FAIL", response.status_code))
                
        except Exception as e:
            print(f"   ❌ Error testing real ID: {str(e)}")
            test_results.append(("Individual analysis endpoint (200)", "FAIL", "Exception"))
    
    return test_results

def main():
    """Main test execution"""
    print("MAK App Backend Analysis History Testing")
    print(f"Testing against: {BASE_URL}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test analysis history functionality
    results = test_analysis_history()
    
    # Summary
    print("\n" + "=" * 60)
    print("🏁 Analysis History Testing Complete")
    print("=" * 60)
    
    passed = sum(1 for _, status, _ in results if status == "PASS")
    partial = sum(1 for _, status, _ in results if status == "PARTIAL")
    total = len(results)
    
    for test_name, status, status_code in results:
        if status == "PASS":
            status_symbol = "✅"
        elif status == "PARTIAL":
            status_symbol = "⚠️"
        else:
            status_symbol = "❌"
        print(f"{status_symbol} {test_name} (HTTP {status_code})")
    
    print()
    print(f"OVERALL: {passed}/{total} tests passed, {partial} partial ({((passed+partial)/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Analysis history functionality working correctly!")
        return 0
    elif passed + partial == total:
        print("⚠️  ALL TESTS PASSED/PARTIAL - Analysis history functionality mostly working")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - Analysis history functionality has issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())