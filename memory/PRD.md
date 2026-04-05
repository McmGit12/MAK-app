# ComplexionFit - AI Skin Analysis & Makeup Recommendation App

## Overview
ComplexionFit is a mobile app that analyzes users' skin characteristics (texture, color, shape) and provides personalized makeup and skincare recommendations using AI technology.

## Core Features

### 1. Authentication
- Simple email login (no password required - auto-create/login)
- Phone OTP login
- No PII stored (only hashed identifiers)

### 2. AI Skin Analysis
- Photo capture via camera or gallery upload
- GPT-4o Vision powered analysis
- Identifies: skin type, skin tone, undertone, face shape
- Detects skin concerns
- Images are NOT stored - only analysis results

### 3. Recommendations
- AI-generated personalized recommendations
- Curated expert picks based on skin profile
- Categories: foundation, concealer, blush, lipstick, skincare, primer

### 4. User Features
- Analysis history
- Feedback submission (rating + comments)
- Privacy-focused (no PII collection)

## Tech Stack
- Frontend: Expo React Native
- Backend: FastAPI
- Database: MongoDB (same region - no cross-region calls)
- AI: OpenAI GPT-4o Vision via Emergent integrations

## Theme
- Elegant Luxury: Dark (#0D0D0D) with Gold (#D4AF37) accents

## Privacy & Security
- No personal identifying information stored
- User identifiers are hashed
- Images processed and discarded immediately
- Database in same region for compliance
