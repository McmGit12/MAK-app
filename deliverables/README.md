# 📦 MAK — Pre-Launch Deliverables

Everything you need to ship your app to Google Play Store. All files are in this folder: `/app/deliverables/`

---

## 📋 What's Inside

| File | What it is | Use for |
|---|---|---|
| **`privacy-policy.html`** | Complete privacy policy webpage | Host on GitHub Pages → paste URL in Play Console |
| **`playstore-copy.md`** | All Play Store text (title, description, keywords) + friend share message | Copy-paste into Play Console |
| **`railway-atlas-setup.md`** | Step-by-step backend self-hosting guide | Deploy backend while Emergent support investigates |
| **`screenshots/`** | 6 Play Store-ready phone screenshots (1236×2745px) | Upload to Play Console store listing |

---

## 🚀 Recommended Order

### Today — Parallel Work (no blockers)
1. **Host the privacy policy** (5 min)
   - Create a free GitHub account if you don't have one
   - New repo → upload `privacy-policy.html`
   - Settings → Pages → enable → get URL like `https://<username>.github.io/<repo>/privacy-policy.html`
   - Save this URL — you'll paste it into Play Console

2. **Start Play Console app creation** (15 min)
   - Go to https://play.google.com/console
   - Click "Create app" → Name: `MAK — Your Makeup Buddy`
   - Fill short & full description from `playstore-copy.md`
   - Upload screenshots from `screenshots/` folder
   - Save as draft

3. **Set up Railway backend** (45 min, parallel track)
   - Follow `railway-atlas-setup.md` end-to-end
   - This guarantees you have a working backend regardless of Emergent support response

4. **Send test invite to friends** (2 min)
   - Use the message from `playstore-copy.md` → Friend Share Message section
   - Share the current preview URL OR wait for the deployed URL

### When Emergent Support Replies OR Railway Is Live
5. **Update `EXPO_PUBLIC_BACKEND_URL`** in `/app/frontend/.env`
6. **Verify backend** — hit `<url>/api/health` in browser
7. **Click "Get Android Builds"** in Emergent
8. **Upload `.aab`** to Play Console
9. **Submit for review** (Google typically responds in 2-7 days)

---

## 🔑 Important Reminders

- **Don't publish the APK** with a broken backend URL — users will see "server not responding" errors
- **Keep the privacy policy URL live** — Google periodically checks it
- **Support email** — you'll need a real one in the Play Store listing. Use a Gmail if you don't have a branded one yet
- **Content rating questionnaire** — answer honestly; beauty apps typically rate "Everyone"
- **Data safety form** — for MAK, select: no data collected beyond email/hashed password; explain that photos are processed but not stored

---

## 📸 About the Screenshots

The 6 screenshots provided are auto-captured from the app at Android phone resolution (1236×2745px). They cover:

1. `01_welcome.png` — Login / Welcome screen
2. `02_home.png` — Home dashboard (personalized greeting)
3. `03_analyze.png` — Analyze tab (Skin Care / Makeup / Travel modes)
4. `04_travel.png` — Travel Style mode
5. `05_profile.png` — Profile / Account area
6. `06_ask_mak.png` — Ask MAK beauty chat

**Want better screenshots?** The most authentic Play Store screenshots come from a real Android device. Once your backend is live:
- Install Expo Go on your phone
- Scan the QR code from the Emergent preview
- Take screenshots using your phone's built-in screenshot feature
- They'll look crisper and more "real" to reviewers

---

## ❓ Need Help?

Just tell me what step you're on — I'll walk you through it or unblock you.

Good luck with the launch! 🌸✨
