# Legalitt — Complete Deploy Guide
# Render + Vercel Now → AWS Later (Zero Code Changes)

## THE BIG PICTURE

How the app works in production:

```
User's Phone (React Native App)
        |
        | HTTPS
        v
  Render.com (Node.js API)  ←→  MongoDB Atlas (database)
        |                   ←→  Cloudinary (files)
        |                   ←→  Razorpay (payments)
        |                   ←→  Anthropic (AI)
        v
  Real-time chat via Socket.io
```

When you move to AWS later, only the middle box changes.
Everything else stays identical.

---

## PHASE 1 — CREATE ALL ACCOUNTS (Day 1, ~2 hours)

### STEP 1 — Create a Dedicated Business Email

Never use your personal Gmail for app accounts.

1. Go to gmail.com
2. Click "Create account" → "For my personal use"
3. First name: Legalitt, Last name: App
4. Email: legalitt.app2024@gmail.com
   (or similar — just not your personal email)
5. Set a strong password — save it in a password manager
6. Skip phone number or use a second number
7. Verify and finish setup

SAVE THIS: legalitt.app2024@gmail.com + password

---

### STEP 2 — GitHub (Code Repository)

Your code lives here. Render reads from here to deploy automatically.

1. Go to github.com
2. Click "Sign up"
3. Enter email: legalitt.app2024@gmail.com
4. Create a username: legalitt-official (or similar)
5. Choose Free plan
6. Verify your email

Create the repository:
1. Click the green "New" button on the dashboard
2. Repository name: legalitt
3. Description: Legal services platform for India
4. Choose: Private
5. Do NOT add README (you already have one)
6. Click "Create repository"

You will see a page with setup instructions.
Copy the URL shown — it looks like:
https://github.com/YOUR_USERNAME/legalitt.git

SAVE THIS: Your GitHub username and repo URL

---

### STEP 3 — MongoDB Atlas (Database)

1. Go to cloud.mongodb.com
2. Click "Try Free"
3. Sign up with: legalitt.app2024@gmail.com
4. Verify email

Create cluster:
1. Click "Build a Database"
2. Choose M0 FREE
3. Provider: AWS
4. Region: ap-south-1 (Mumbai) ← IMPORTANT for Indian users
5. Cluster name: legalitt-prod
6. Click "Create"

Create database user:
1. Left sidebar → "Database Access"
2. Click "Add New Database User"
3. Authentication: Password
4. Username: legalitt_admin
5. Password: Click "Autogenerate Secure Password"
6. COPY AND SAVE THE PASSWORD NOW
7. User Privileges: "Atlas admin"
8. Click "Add User"

Allow connections from anywhere:
1. Left sidebar → "Network Access"
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Click "Confirm"

Get your connection string:
1. Left sidebar → "Database"
2. Click "Connect" on your cluster
3. Click "Drivers"
4. Driver: Node.js, Version: 5.5 or later
5. Copy the connection string — looks like:
   mongodb+srv://YOUR_USERNAME@YOUR_CLUSTER/YOUR_DATABASE

6. Replace <password> with your saved password
7. Add database name before the ?:
   mongodb+srv://YOUR_USERNAME@YOUR_CLUSTER/YOUR_DATABASE

SAVE THIS: The full connection string with your password

---

### STEP 4 — Render (Backend Hosting)

1. Go to render.com
2. Click "Get Started for Free"
3. Sign up with: legalitt.app2024@gmail.com
4. Verify email
5. When asked "What brings you to Render?" → select "Deploy a web service"

Connect GitHub:
1. Click your profile picture → "Account Settings"
2. "Connected Accounts" section
3. Click "Connect GitHub"
4. Authorize Render to access your GitHub

SAVE THIS: Render login confirmed

---

### STEP 5 — Google Cloud (Google Sign-In for App)

1. Go to console.cloud.google.com
2. Sign in with: legalitt.app2024@gmail.com
3. Accept terms and conditions

Create project:
1. Click "Select a project" at the top
2. Click "New Project"
3. Project name: Legalitt
4. Location: No organization
5. Click "Create"
6. Wait ~30 seconds, then select your new project

Configure OAuth consent screen:
1. Left menu → "APIs & Services" → "OAuth consent screen"
2. User Type: External → "Create"
3. App name: Legalitt
4. User support email: legalitt.app2024@gmail.com
5. App logo: skip for now
6. Developer contact: legalitt.app2024@gmail.com
7. Click "Save and Continue"
8. Click "Save and Continue" (scopes page — skip)
9. Click "Save and Continue" (test users — skip)
10. Click "Back to Dashboard"

Create OAuth credentials:
1. Left menu → "Credentials"
2. Click "+ Create Credentials" → "OAuth client ID"
3. Application type: Web application
4. Name: Legalitt Web Client
5. Authorized JavaScript origins: (leave empty for now)
6. Authorized redirect URIs: add https://legalitt-api.onrender.com/auth/google/callback
7. Click "Create"
8. A popup shows your Client ID and Client Secret
9. COPY BOTH AND SAVE THEM

Client ID looks like: 123456789-abcdefgh.apps.googleusercontent.com

SAVE THIS: Google Client ID and Client Secret

---

### STEP 6 — Cloudinary (File Storage for Photos & Documents)

1. Go to cloudinary.com
2. Click "Sign Up for Free"
3. Email: legalitt.app2024@gmail.com
4. Password: create one and save it
5. First name: Legalitt
6. Complete signup and verify email

Get credentials:
1. After login, you land on the Dashboard
2. You will see three values immediately:
   - Cloud Name (e.g., dxxxxxxxxx)
   - API Key (e.g., 123456789012345)
   - API Secret (click "reveal" to see it)
3. Copy all three

SAVE THIS: Cloud Name, API Key, API Secret

---

### STEP 7 — Razorpay (Payments — Indian Gateway)

1. Go to razorpay.com
2. Click "Sign Up"
3. Email: legalitt.app2024@gmail.com
4. Phone: use your business/dedicated phone number
5. Business name: Legalitt
6. Password: create one and save it
7. Verify email and phone

Get TEST keys (you can start testing before KYC):
1. Login → left sidebar → "Settings"
2. Click "API Keys" tab
3. Click "Generate Test Key"
4. A popup shows:
   - Key ID: rzp_test_XXXXXXXXXXXXXXXX
   - Key Secret: (shown once — copy immediately)
5. Copy both

NOTE: You will switch to Live keys after completing KYC (business verification).
KYC requires: PAN card, bank account, business address.
Apply for KYC now — it takes 2-5 business days.

SAVE THIS: Test Key ID and Test Key Secret

---

### STEP 8 — Anthropic (AI Features)

1. Go to console.anthropic.com
2. Click "Sign Up"
3. Email: legalitt.app2024@gmail.com
4. Verify email
5. You get $5 free credits — enough for months of testing

Create API key:
1. Left sidebar → "API Keys"
2. Click "Create Key"
3. Name: legalitt-production
4. Click "Create Key"
5. The key appears ONCE — copy it immediately
   Looks like: sk-ant-api03-xxxxxxxxxxxxxxxxxx

SAVE THIS: Anthropic API Key

---

### STEP 9 — Expo (Mobile App Builds)

1. Go to expo.dev
2. Click "Create an account"
3. Email: legalitt.app2024@gmail.com
4. Username: legalitt
5. Verify email

Install Expo tools on your computer (do this now):
Open Terminal (Mac) or Command Prompt (Windows) and run:
  npm install -g @expo/cli eas-cli

Verify installation:
  expo --version
  eas --version

SAVE THIS: Expo account confirmed

---

### STEP 10 — Firebase (Push Notifications)

1. Go to console.firebase.google.com
2. Sign in with legalitt.app2024@gmail.com
3. Click "Create a project"
4. Name: legalitt-prod
5. Disable Google Analytics → Continue
6. Click "Create project" → Continue

Add Android app:
1. Click the Android icon (</>) on the dashboard
2. Android package name: com.legalitt.app
3. App nickname: Legalitt Android
4. Click "Register app"
5. Click "Download google-services.json" — SAVE THIS FILE
6. Click "Next" three times → "Continue to console"

SAVE THIS: google-services.json file downloaded

---

## PHASE 2 — SET UP CODE ON YOUR COMPUTER (Day 2, ~2 hours)

### STEP 11 — Install Required Software

Open Terminal (Mac/Linux) or Command Prompt (Windows).

Install Node.js:
1. Go to nodejs.org
2. Download LTS version (v20 or higher)
3. Install with all defaults
4. Verify: node --version  (should show v20.x.x)

Install Git:
1. Go to git-scm.com/download
2. Download for your OS
3. Install with all defaults
4. Verify: git --version

Install Expo & EAS:
  npm install -g @expo/cli eas-cli
  
Verify:
  expo --version
  eas --version

---

### STEP 12 — Set Up the Project

Extract the downloaded legalitt-complete.tar.gz:

On Mac/Linux:
  tar -xzf legalitt-complete.tar.gz
  cd legalitt

On Windows:
  Right-click → Extract All → then open the folder

Initialize Git and push to GitHub:
  git init
  git add .
  git commit -m "Initial commit"
  git remote add origin https://github.com/YOUR_USERNAME/legalitt.git
  git branch -M main
  git push -u origin main

You will be asked for GitHub username and password.
For password: use a Personal Access Token (not your GitHub password).
Create one at: github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → select "repo" scope → copy it.

---

### STEP 13 — Configure Backend

  cd backend
  cp .env.example .env

Generate JWT secrets — run this TWICE and save both outputs:
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

Now edit the .env file. Open it in any text editor:
  
  On Mac: open -e .env
  On Windows: notepad .env
  
Fill in every value:

  NODE_ENV=development
  PORT=5000
  MONGODB_URI=<your MongoDB connection string from Step 3>
  JWT_SECRET=<first random string you generated>
  JWT_REFRESH_SECRET=<second random string you generated>
  JWT_EXPIRES_IN=15m
  JWT_REFRESH_EXPIRES_IN=7d
  GOOGLE_CLIENT_ID=<your Google Client ID from Step 5>
  RESEND_API_KEY=<your Resend API key>
  RESEND_FROM=Legalitt <verify@your-verified-domain.com>
  CLOUDINARY_CLOUD_NAME=<from Step 6>
  CLOUDINARY_API_KEY=<from Step 6>
  CLOUDINARY_API_SECRET=<from Step 6>
  RAZORPAY_KEY_ID=<rzp_test_ key from Step 7>
  RAZORPAY_KEY_SECRET=<test secret from Step 7>
  ANTHROPIC_API_KEY=<from Step 8>
  FRONTEND_URL=http://localhost:3000
  RATE_LIMIT_WINDOW_MS=900000
  RATE_LIMIT_MAX=100

Save the file.

---

### STEP 14 — Test Backend Locally

  cd backend
  npm install
  npm run dev

You should see:
  Server running on port 5000 [development]
  MongoDB connected: legalitt-prod.xxxxx.mongodb.net

In a new terminal:
  cd backend
  npm run seed

You should see:
  Seeded: Ajay Chohan
  Seeded: Priya Sharma
  ...
  Admin created: admin@legalitt.com / Admin@12345

Test the API:
  curl http://localhost:5000/health
  
Response should be: {"success":true,"message":"Legalitt API is running",...}

---

### STEP 15 — Configure Mobile App

Find your computer's IP address:
  Mac/Linux: ifconfig | grep "inet " | grep -v 127
  Windows: ipconfig (look for IPv4 Address)
  Example IP: 192.168.1.5

Your phone and computer MUST be on the same WiFi network.

  cd ../mobile-app
  cp .env.example .env

Edit .env:
  API_URL=http://192.168.1.5:5000/api    <- use YOUR actual IP
  SOCKET_URL=http://192.168.1.5:5000
  GOOGLE_WEB_CLIENT_ID=<your Google Client ID>
  RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX

Place Firebase file:
  Copy google-services.json into the mobile-app folder

Install dependencies:
  npm install

---

### STEP 16 — Run App on Your Phone

Install Expo Go on your phone:
  Android: Play Store → search "Expo Go" → Install
  iPhone: App Store → search "Expo Go" → Install

Start the app:
  npx expo start

A QR code appears in terminal.

On your phone:
  Android: Open Expo Go app → Scan QR code
  iPhone: Open Camera app → point at QR code → tap notification

App loads on your phone.

Test the complete flow:
  1. Splash screen (teal with gavel icon)
  2. Three onboarding slides
  3. Login/Register → Register with email
  4. Choose role: User
  5. Home screen shows nearby advocates (Jabalpur area)
  6. Tap an advocate → see profile
  7. Tap Book Consultation
  8. Fill in date and describe your issue
  9. Payment screen → select UPI → tap Pay
     (In test mode, payment auto-succeeds)
  10. "Consultation Booked Successfully" screen
  11. Tap Start Chat → chat screen opens

If something doesn't work:
  - Check backend terminal for error messages
  - Confirm your phone is on same WiFi as computer
  - Confirm the IP in mobile-app/.env matches your computer's IP

---

## PHASE 3 — DEPLOY BACKEND TO RENDER (Day 3, ~1 hour)

### STEP 17 — Create Web Service on Render

1. Log into render.com
2. Click "New +" → "Web Service"
3. Click "Connect account" → connect your GitHub
4. Find your "legalitt" repository → click "Connect"
5. Fill in the form:

   Name: legalitt-api
   Region: Singapore (closest to India)
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm install
   Start Command: node src/server.js
   Plan: Free

6. Scroll down to "Environment Variables"
7. Add each variable one by one (copy from infra/env-render.txt):

   Click "Add Environment Variable" for each:

   Key: NODE_ENV              Value: production
   Key: PORT                  Value: 5000
   Key: MONGODB_URI           Value: <your full MongoDB URI>
   Key: JWT_SECRET            Value: <your jwt secret>
   Key: JWT_REFRESH_SECRET    Value: <your refresh secret>
   Key: JWT_EXPIRES_IN        Value: 15m
   Key: JWT_REFRESH_EXPIRES_IN Value: 7d
   Key: GOOGLE_CLIENT_ID      Value: <your google client id>
   Key: CLOUDINARY_CLOUD_NAME Value: <your cloud name>
   Key: CLOUDINARY_API_KEY    Value: <your api key>
   Key: CLOUDINARY_API_SECRET Value: <your api secret>
   Key: RAZORPAY_KEY_ID       Value: <rzp_test_xxxx>
   Key: RAZORPAY_KEY_SECRET   Value: <your razorpay secret>
   Key: ANTHROPIC_API_KEY     Value: <your anthropic key>
   Key: FRONTEND_URL          Value: https://legalitt.vercel.app
   Key: RATE_LIMIT_WINDOW_MS  Value: 900000
   Key: RATE_LIMIT_MAX        Value: 100

8. Click "Create Web Service"

Render will now:
  - Download your code from GitHub
  - Run npm install
  - Start your server
  - Give you a URL like: https://legalitt-api.onrender.com

This takes 3-5 minutes. Watch the logs in the Deploy tab.

---

### STEP 18 — Seed Production Database

Wait for Render deployment to finish (green "Live" badge).

Go to your service → "Shell" tab → type:
  node src/utils/seed.js

Output:
  Seeded: Ajay Chohan
  ...
  Admin created: admin@legalitt.com / Admin@12345

Test the live API:
  Open your browser and visit:
  https://legalitt-api.onrender.com/health
  
  You should see: {"success":true,"message":"Legalitt API is running",...}

---

### STEP 19 — Set Up Auto-Deploy

Every time you push to GitHub, Render deploys automatically.

But first, set up GitHub Actions for testing before deploy:

1. In your repo on GitHub: Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add these two secrets:

   Name: RENDER_API_KEY
   Value: (Render dashboard → Account Settings → API Keys → Create API Key → copy it)

   Name: RENDER_SERVICE_ID
   Value: (Render dashboard → your service → the URL contains it: srv-xxxxxxxxxx)
   
   To find service ID: look at your service URL in Render
   Example: https://dashboard.render.com/web/srv-abcdefghijkl
   The service ID is: srv-abcdefghijkl

The GitHub Actions workflow in .github/workflows/deploy.yml will now:
  - Run tests on every push
  - Deploy to Render automatically if tests pass

---

### STEP 20 — Prevent Render Free Tier Sleeping

Free Render services sleep after 15 minutes of inactivity.
This causes a 30-60 second cold start delay on first request.

Fix: Set up a free uptime monitor to ping every 5 minutes.

1. Go to uptimerobot.com
2. Click "Register for FREE"
3. Sign up with legalitt.app2024@gmail.com
4. Click "Add New Monitor"
5. Monitor Type: HTTP(s)
6. Friendly Name: Legalitt API
7. URL: https://legalitt-api.onrender.com/health
8. Monitoring Interval: Every 5 minutes
9. Click "Create Monitor"

Now your API stays awake 24/7 even on the free plan.

Longer-term: Upgrade to Render Starter ($7/month) to eliminate cold starts
entirely and get a custom domain (api.legalitt.com).

---

## PHASE 4 — UPDATE APP TO USE PRODUCTION API (Day 3)

### STEP 21 — Update Mobile App Config

Edit mobile-app/.env:
  API_URL=https://legalitt-api.onrender.com/api
  SOCKET_URL=https://legalitt-api.onrender.com
  GOOGLE_WEB_CLIENT_ID=<your google client id>
  RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX

Test on your phone:
  npx expo start
  Scan QR code — app now connects to Render, not local server
  
Register a new account and make a test booking to confirm everything works.

---

## PHASE 5 — BUILD FOR PLAY STORE (Day 4-5, ~3 hours)

### STEP 22 — Create Google Play Developer Account

1. Go to play.google.com/console
2. Sign in with: legalitt.app2024@gmail.com
3. Click "Get Started"
4. Pay $25 USD one-time fee (requires credit/debit card)
   This is approximately ₹2,100
5. Fill in developer name: Legalitt
6. Complete account setup → Accept agreements

---

### STEP 23 — Prepare App Assets

You need these images before submitting to Play Store.

App Icon (512×512 PNG):
1. Go to canva.com → sign up free
2. Create design → Custom size → 512 × 512 pixels
3. Background: solid teal (#0d9488)
4. Add a white gavel or scales icon in the center
5. Download as PNG
6. Save as: mobile-app/assets/icon.png

Also create these sizes (Canva can resize):
  mobile-app/assets/adaptive-icon.png (1024×1024)
  mobile-app/assets/splash.png (1242×2436)

Feature Graphic (1024×500 PNG):
1. In Canva, create 1024×500 design
2. Use teal background
3. Add: app icon on left, "Legalitt" text, "Find Verified Advocates Near You"
4. Download as PNG — you'll upload this to Play Store

Screenshots (take these from Expo Go on your phone):
1. Open the app in Expo Go
2. Navigate to Home screen → take screenshot
3. Navigate to Advocate Profile → take screenshot
4. Navigate to Chat → take screenshot
Minimum 2 screenshots required, up to 8 allowed.

---

### STEP 24 — Configure EAS

  cd mobile-app
  eas login
  
Enter your expo.dev email and password.

  eas init

When asked:
  "What would you like to call your project?" → legalitt
  "What is the slug?" → legalitt

This creates a project on expo.dev and updates app.json with your project ID.

Get your Android SHA-1 fingerprint (needed for Google Sign-In):
  eas credentials --platform android
  
When asked, select "Keystore: Add new keystore"
After it's created, look for the line that says "SHA-1 certificate fingerprint"
It looks like: AB:CD:EF:12:34:56:...
Copy it.

Add SHA-1 to Google Cloud:
1. console.cloud.google.com → Credentials
2. Click "+ Create Credentials" → OAuth client ID
3. Application type: Android
4. Name: Legalitt Android
5. Package name: com.legalitt.app
6. SHA-1 certificate fingerprint: paste what you copied
7. Click Create

---

### STEP 25 — Build Test APK

Build a test APK first to verify everything works on a real phone:

  cd mobile-app
  eas build --platform android --profile preview

This takes 10-20 minutes. EAS builds on their servers.
When complete, you get a download link.

Download the APK → transfer to Android phone → tap to install.

Enable "Install unknown apps" if Android asks.

Test everything on the APK:
  - Google Sign-In works
  - Location permission works
  - Nearby advocates appear
  - Book and pay works (Razorpay checkout opens natively)
  - Chat works

Fix any issues before building the production version.

---

### STEP 26 — Build Production AAB (for Play Store)

Once testing is complete:

  eas build --platform android --profile production

This creates an .aab (Android App Bundle) file.
The Play Store requires .aab format (not .apk).

Download link appears when done (~15 minutes).
Download and save the .aab file.

---

### STEP 27 — Create App in Play Console

1. Go to play.google.com/console
2. Click "Create app"
3. Fill in:
   App name: Legalitt - Find Advocates Near You
   Default language: Hindi (hi) or English
   App or game: App
   Free or paid: Free
4. Tick both declarations
5. Click "Create app"

---

### STEP 28 — Fill in Store Listing

Left sidebar → "Store presence" → "Main store listing"

App name: Legalitt - Find Advocates Near You

Short description (80 chars max):
  Find verified advocates nearby. Book consultations instantly.

Full description (4000 chars max):
  Legalitt connects you with verified, experienced advocates across India.

  FIND ADVOCATES NEAR YOU
  Use your location to find verified advocates in your city. Filter by specialization, language, and consultation fees.

  BOOK INSTANTLY
  Book a consultation in 3 taps. Pay securely via UPI, cards, or net banking through Razorpay.

  SECURE IN-APP CHAT
  After booking, chat directly with your advocate inside the app. No phone number sharing needed.

  AI LEGAL ASSISTANT
  Get instant answers to general legal questions. Generate FIR drafts. Powered by Claude AI.

  DOCUMENT MANAGEMENT
  Upload and share legal documents securely with your advocate.

  PRACTICE AREAS
  Criminal Law | Civil Law | Family Law | Property Law | Corporate Law | Consumer Law | Cyber Law | Tax Law | Labour Law | Constitutional Law

  DISCLAIMER: AI features provide general legal information only. Always consult a qualified advocate for your specific legal situation.

Upload graphics:
  - App icon: the 512×512 PNG you created
  - Feature graphic: the 1024×500 PNG
  - Screenshots: at least 2 phone screenshots

Click "Save"

---

### STEP 29 — Content Rating

Left sidebar → "Policy" → "App content" → "Content rating"

1. Click "Start questionnaire"
2. Email: legalitt.app2024@gmail.com
3. Category: Utilities / Productivity
4. Answer questions:
   - Violence: No
   - Sexual content: No
   - Language: No
   - Controlled substances: No
   - User-generated content: Yes (chat messages)
5. Click "Save questionnaire"
6. Click "Calculate rating"
7. Click "Apply rating"

Rating will be: Everyone (E) — no content warnings.

---

### STEP 30 — Set Up Release

Left sidebar → "Release" → "Testing" → "Internal testing"

1. Click "Create new release"
2. Click "Upload" → select your .aab file
3. Release name: 1.0.0
4. Release notes: "Initial release of Legalitt"
5. Click "Save"
6. Click "Review release"
7. Click "Start rollout to Internal testing"

Add testers:
1. Click "Testers" tab
2. Click "Create email list"
3. List name: Team
4. Add your email addresses (the people who will test)
5. Click "Save changes"
6. Click "Copy link" — send this link to your testers
   They can install the app from Play Store using this link

---

### STEP 31 — Test and Fix

Your testers install from the internal test link.

Common things to fix:
  - If Google Sign-In fails: double check SHA-1 in Google Cloud Console
  - If payments don't work: verify Razorpay keys are in mobile-app/.env
  - If chat doesn't connect: check WebSocket URL in .env

For each fix:
1. Change the code
2. Commit and push to GitHub
3. Run: eas build --platform android --profile production
4. Upload new .aab to Play Console → create new release

---

### STEP 32 — Submit to Production

Once internal testing is complete and working:

1. Left sidebar → "Release" → "Production"
2. Click "Create new release"
3. Click "Add from library" → select your latest release
4. Add release notes
5. Click "Save"
6. Click "Review release"
7. Click "Start rollout to Production" → 100%

Play Store review:
  New apps take 3-7 days for first review
  Updates take 1-3 days
  You'll get an email when approved/rejected

---

## PHASE 6 — APP STORE (iOS) — OPTIONAL

### STEP 33 — Apple Developer Account

1. Go to developer.apple.com
2. Click "Account" → "Enroll"
3. Sign in with an Apple ID (create one with legalitt.app2024@gmail.com if you don't have one)
4. Individual account: $99 USD/year (₹8,300/year)
5. Complete enrollment (requires credit card)

---

### STEP 34 — Build for iOS

  cd mobile-app
  eas build --platform ios --profile production

EAS will ask you to log into Apple with your Developer account.
It handles certificates and provisioning profiles automatically.

Build takes 15-20 minutes.

---

### STEP 35 — Submit to App Store

  eas submit --platform ios

Or manually in App Store Connect:
1. appstoreconnect.apple.com
2. "My Apps" → "+" → "New App"
3. Fill in details
4. Upload build
5. Submit for review (1-3 days)

---

## PHASE 7 — GO LIVE WITH REAL PAYMENTS

### STEP 36 — Complete Razorpay KYC

After app is live on Play Store, complete KYC to enable real payments.

1. razorpay.com → login
2. Left sidebar → "Account & Business" → "Business Settings"
3. Complete verification:
   - Business type: Proprietorship (easiest for solo founder)
   - Business PAN: your personal PAN card
   - Bank account: add your bank account details
   - Address proof: Aadhaar card
4. Submit → approval in 2-5 business days

Once approved:
1. Settings → API Keys → Generate Live Key
2. Copy rzp_live_XXXX key and secret

Update on Render:
1. Render dashboard → legalitt-api → Environment
2. Edit RAZORPAY_KEY_ID → change to rzp_live_XXXX
3. Edit RAZORPAY_KEY_SECRET → change to live secret
4. Render auto-redeploys

Update mobile app:
1. Edit mobile-app/.env: RAZORPAY_KEY_ID=rzp_live_XXXX
2. Also update in eas.json production env
3. Build new version: eas build --platform android --profile production
4. Submit to Play Store as a new release

---

## PHASE 8 — APPROVE YOUR FIRST ADVOCATES

### STEP 37 — Advocate Approval Flow

When advocates register, they appear as "pending verification".
You need to verify and approve them via the admin API.

Get admin token:
  curl -X POST https://legalitt-api.onrender.com/api/auth/login     -H "Content-Type: application/json"     -d '{"email":"admin@legalitt.com","password":"Admin@12345"}'
  
  Copy the "accessToken" from the response.

See pending advocates:
  curl https://legalitt-api.onrender.com/api/admin/advocates/pending     -H "Authorization: Bearer YOUR_TOKEN_HERE"

Approve an advocate:
  curl -X PATCH https://legalitt-api.onrender.com/api/admin/advocates/ADVOCATE_ID_HERE/verify     -H "Authorization: Bearer YOUR_TOKEN_HERE"     -H "Content-Type: application/json"     -d '{"status":"approved"}'

Change ADVOCATE_ID_HERE to the _id from the pending list.

---

## MOVING TO AWS LATER (When you're ready to scale)

### What triggers the move
- 500+ daily active users
- Render free tier too slow
- Need auto-scaling for traffic spikes
- Cost: AWS t3.small = $17/mo vs Render starter = $7/mo
  (AWS is cheaper when you need more resources)

### What changes
ONLY infrastructure changes. Zero code changes.

- Render → AWS EC2 (same Node.js code runs identically)
- Domain: add api.legalitt.com pointing to EC2
- SSL: Certbot on EC2 (same as nginx.conf in the repo)
- Mobile app: update API_URL from render URL to your domain
  then rebuild one EAS production build → submit to Play Store

### How to do it
See: infra/aws-migration.md in your repo
Run: infra/aws-setup.sh on your EC2 instance

All your environment variables stay identical.
All your data stays in MongoDB Atlas (unchanged).
Takes about 2 hours total.

---

## QUICK REFERENCE

Daily commands:
  Start backend dev server:     cd backend && npm run dev
  Start mobile app:             cd mobile-app && npx expo start
  Push code + auto-deploy:      git add . && git commit -m "update" && git push

Build commands:
  Test APK (for testing):       eas build --platform android --profile preview
  Production AAB (Play Store):  eas build --platform android --profile production
  iOS build (App Store):        eas build --platform ios --profile production

Check production:
  API health:    https://legalitt-api.onrender.com/health
  Render logs:   render.com → your service → Logs tab
  Atlas metrics: cloud.mongodb.com → your cluster → Metrics

Emergency fix:
  Rollback on Render: Render dashboard → Deploys → click previous deploy → "Rollback"
