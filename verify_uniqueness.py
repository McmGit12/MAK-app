#!/usr/bin/env python3
"""
Quick verification of travel-style response uniqueness
"""

import requests
import json

BASE_URL = "https://makeup-buddy-preview.preview.emergentagent.com/api"

def test_travel_responses():
    print("🔍 Verifying Travel Style Response Uniqueness")
    print("=" * 60)
    
    # Test Mumbai
    mumbai_payload = {
        "country": "Mumbai, Maharashtra, India",
        "month": "July",
        "occasion": "Wedding"
    }
    
    mumbai_response = requests.post(f"{BASE_URL}/travel-style", json=mumbai_payload, timeout=30)
    mumbai_data = mumbai_response.json()
    
    print("📍 MUMBAI RESPONSE:")
    print(f"Destination Info: {mumbai_data['destination_info'][:150]}...")
    print(f"Overall Vibe: {mumbai_data['overall_vibe']}")
    print(f"First Outfit: {mumbai_data['outfit_suggestions'][0]['suggestion'][:100]}...")
    print()
    
    # Test Tokyo
    tokyo_payload = {
        "country": "Tokyo, Kanto, Japan",
        "month": "March",
        "occasion": "Sightseeing / Tourist"
    }
    
    tokyo_response = requests.post(f"{BASE_URL}/travel-style", json=tokyo_payload, timeout=30)
    tokyo_data = tokyo_response.json()
    
    print("📍 TOKYO RESPONSE:")
    print(f"Destination Info: {tokyo_data['destination_info'][:150]}...")
    print(f"Overall Vibe: {tokyo_data['overall_vibe']}")
    print(f"First Outfit: {tokyo_data['outfit_suggestions'][0]['suggestion'][:100]}...")
    print()
    
    # Verify differences
    print("🔍 UNIQUENESS VERIFICATION:")
    print(f"✅ Destination info different: {mumbai_data['destination_info'] != tokyo_data['destination_info']}")
    print(f"✅ Overall vibe different: {mumbai_data['overall_vibe'] != tokyo_data['overall_vibe']}")
    print(f"✅ Outfit suggestions different: {mumbai_data['outfit_suggestions'] != tokyo_data['outfit_suggestions']}")
    print(f"✅ Makeup looks different: {mumbai_data['makeup_look'] != tokyo_data['makeup_look']}")

if __name__ == "__main__":
    test_travel_responses()