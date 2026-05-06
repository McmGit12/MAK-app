# MAK App — Backend Self-Hosting Guide (Railway + MongoDB Atlas)

> **Total time:** ~45–60 minutes  
> **Cost:** Free tier to start (Railway gives $5/mo credit; Atlas free forever 512MB)  
> **What you'll get:** A real live backend URL like `https://mak-backend-production.up.railway.app` that your Android APK can point to.

---

## 🎯 Why this?

Your Emergent backend deployment isn't responding at the expected URL. While Emergent support investigates, self-hosting the backend gives you a reliable, production-ready URL so you can ship your APK to Play Store without being blocked.

---

## Step 1 — Set Up MongoDB Atlas (Free Cloud Database) · ~10 min

1. Go to https://www.mongodb.com/atlas and click **"Try Free"**
2. Sign up with email or Google
3. Choose **M0 Free tier** (512MB, forever free)
4. Pick cloud provider: **AWS**, region closest to your users (e.g., Mumbai ap-south-1 if India, or N. Virginia us-east-1)
5. Cluster name: `mak-cluster`
6. Click **"Create Cluster"** — takes ~3 min to provision

### Create a database user
1. Left sidebar → **Database Access** → **Add New Database User**
2. Username: `mak_admin`  
3. Password: click **"Autogenerate Secure Password"** → **COPY AND SAVE IT**
4. Role: **Read and write to any database**
5. Click **"Add User"**

### Allow access from anywhere (Railway IPs are dynamic)
1. Left sidebar → **Network Access** → **Add IP Address**
2. Click **"Allow Access from Anywhere"** (0.0.0.0/0) — OK for free tier since DB user has password
3. Click **Confirm**

### Get your connection string
1. Left sidebar → **Database** → click **"Connect"** on your cluster
2. Choose **"Drivers"** → **Python** → **3.6 or later**
3. Copy the connection string, looks like:
   ```
   mongodb+srv://mak_admin:<password>@mak-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your saved password. **SAVE THIS ENTIRE STRING** — you'll paste it into Railway next.

---

## Step 2 — Deploy Backend on Railway · ~15 min

### 2a. Prepare your code
1. Go to your local project: `/app/backend/` (or wherever your FastAPI code lives)
2. Make sure you have these files:
   - `server.py` ✅
   - `requirements.txt` ✅
   - `.env` (don't commit this!)

### 2b. Push to GitHub (if not already)
```bash
cd /app
git init
git add .
git commit -m "Initial commit — MAK backend"
# Create a new repo on github.com, then:
git remote add origin https://github.com/<your-username>/mak-app.git
git push -u origin main
```

### 2c. Deploy on Railway
1. Go to https://railway.app → **Sign up with GitHub**
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Authorize Railway, select your `mak-app` repo
4. Railway auto-detects Python. Click **"Deploy Now"**

### 2d. Configure the backend
1. Click on the deployed service (usually "mak-app")
2. Go to **"Settings"** tab:
   - **Root directory:** `/backend`
   - **Start command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
3. Go to **"Variables"** tab, add:
   ```
   MONGO_URL = <paste your Atlas connection string from Step 1>
   DB_NAME = complexionfit_db
   EMERGENT_LLM_KEY = sk-emergent-b78D15eB909Dd72De5
   ```
4. Click **"Deploy"** — takes ~3 min to build and start

### 2e. Get your live URL
1. Go to **"Settings"** → **"Networking"** → **"Generate Domain"**
2. Railway gives you a URL like: `https://mak-app-production.up.railway.app`
3. **Test it:**
   ```
   https://mak-app-production.up.railway.app/api/health
   ```
   Should return: `{"status":"healthy","mongodb":"connected",...}`

---

## Step 3 — Point Your Expo App to the New Backend · ~5 min

1. Open `/app/frontend/.env`
2. Change this line:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://mak-makeup-buddy.preview.emergentagent.com
   ```
   To:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://mak-app-production.up.railway.app
   ```
   (use your actual Railway URL)
3. Save the file
4. Tell me you've done this — I'll verify the frontend picks it up correctly

---

## Step 4 — Register the Test User on the New Backend · ~2 min

The Atlas DB is empty, so we need to re-seed. Use the Expo app's signup flow OR run:

```bash
curl -X POST https://mak-app-production.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@mak.com","name":"Test User","password":"test123456"}'
```

---

## Step 5 — Build Your Android APK · varies

With a working backend URL embedded:
1. In Emergent: click **"Get Android Builds"**
2. Wait for build (10–20 min)
3. Download the `.aab` file
4. Upload to Google Play Console

---

## Troubleshooting

### Railway deploy fails with "No module found"
- Verify `requirements.txt` includes everything (run `pip freeze > requirements.txt` locally and commit)

### /api/health times out
- Check Railway logs → verify "Application startup complete" appears
- Verify `MONGO_URL` variable is set correctly
- Check Atlas Network Access allows 0.0.0.0/0

### "Failed to connect to MongoDB"
- Did you replace `<password>` in the connection string?
- Is the Atlas user set to "Read and write to any database"?

### CORS errors in app
- Your `server.py` already has `allow_origins=["*"]` — should work

---

## Cost Monitoring

- **Railway:** $5 free credit/month. After that, ~$5/month for a small FastAPI app
- **Atlas:** Free forever for 512MB (enough for 5000+ users)
- **Your cost:** $0–5/month total

---

## Why not stay on Railway forever?

You can! Railway is production-grade. If Emergent support eventually says your native deployment works, you can switch back at any time by flipping the `EXPO_PUBLIC_BACKEND_URL` — but Railway also works great as a permanent solution.

---

Need help with any step? Just tell me which one and I'll walk through it with you.
