# Legalitt — Complete Setup Guide

## 🏗️ Project Structure
```
legalitt/
├── backend/          # Node.js + Express API
└── mobile-app/       # React Native (Expo)
```

---

## ⚙️ Backend Setup

### 1. Prerequisites
- Node.js 20+
- MongoDB Atlas account
- Cloudinary account
- Razorpay account (Indian payment gateway)

### 2. Install & Configure
```bash
cd backend
npm install
cp .env.example .env
# Fill in all values in .env
```

### 3. Required .env Values
```
MONGODB_URI=mongodb+srv://YOUR_USERNAME@YOUR_CLUSTER/YOUR_DATABASE
JWT_SECRET=min_32_char_random_string_here
JWT_REFRESH_SECRET=another_32_char_random_string
GOOGLE_CLIENT_ID=477031689444-qss3ik1q1cvgtcels5uq04qfmh38msa4.apps.googleusercontent.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
RAZORPAY_KEY_ID=rzp_test_xxxx
RAZORPAY_KEY_SECRET=your_secret
ANTHROPIC_API_KEY=sk-ant-xxxx
FRONTEND_URL=https://legalitt-gxff.vercel.app
```

### 4. Seed Database
```bash
npm run seed
# Creates 6 advocates in MP cities + admin user
# Admin: admin@legalitt.com / Admin@12345
```

### 5. Run Development Server
```bash
npm run dev
# Server starts on http://localhost:5000
# Health check: GET http://localhost:5000/health
```

### 6. Create MongoDB Indexes (run once)
```js
// In MongoDB Atlas shell or Compass:
db.advocates.createIndex({ location: "2dsphere" })
db.advocates.createIndex({ "location.address.city": 1 })
db.advocates.createIndex({ specializations: 1 })
db.bookings.createIndex({ client: 1, status: 1 })
db.messages.createIndex({ chat: 1, createdAt: -1 })
```

---

## 📱 Mobile App Setup

### 1. Prerequisites
- Node.js 20+
- Expo CLI: `npm install -g @expo/cli`
- Expo Go app on Android/iOS

### 2. Install
```bash
cd mobile-app
npm install
cp .env.example .env
# Set API_URL and other values
```

### 3. .env Values
```
API_URL=http://YOUR_LOCAL_IP:5000/api   # Use actual IP, not localhost
GOOGLE_WEB_CLIENT_ID=477031689444-qss3ik1q1cvgtcels5uq04qfmh38msa4.apps.googleusercontent.com
RAZORPAY_KEY_ID=rzp_test_xxxx
SOCKET_URL=http://YOUR_LOCAL_IP:5000
```

### 4. Run
```bash
npx expo start
# Scan QR with Expo Go on your phone
# Press 'a' for Android emulator, 'i' for iOS simulator
```

### 5. Google Sign-In Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google Sign-In API
3. Add SHA-1 fingerprint for Android
4. Download `google-services.json` → place in `mobile-app/`
5. Download `GoogleService-Info.plist` → place in `mobile-app/`

---

## 🚀 Deployment

### Backend on Render (Current)
```bash
# Already deployed at legalitt-api.onrender.com
# Set all env vars in Render dashboard
# Add start command: node src/server.js
```

### Backend on AWS EC2 (Recommended for Scale)
```bash
# 1. Launch EC2 t3.small, Ubuntu 22.04
# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2
npm install -g pm2

# 4. Clone repo and install
git clone https://github.com/Krishsoni9827/legalitt
cd legalitt/backend
npm install --production

# 5. Create .env with production values

# 6. Start with PM2
pm2 start src/server.js --name legalitt-api
pm2 startup
pm2 save

# 7. Setup Nginx as reverse proxy
sudo apt install nginx
# Add config in /etc/nginx/sites-available/legalitt
# proxy_pass http://localhost:5000;

# 8. SSL with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.legalitt.com
```

### Docker Deployment
```bash
cd backend

# Build image
docker build -t legalitt-api .

# Run container
docker run -d \
  --name legalitt-api \
  -p 5000:5000 \
  --env-file .env \
  --restart unless-stopped \
  legalitt-api

# Or with docker-compose:
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "5000:5000"
    env_file: .env
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
```

### Play Store Build
```bash
cd mobile-app

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure
eas build:configure

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production

# Submit to Play Store
eas submit --platform android

# Submit to App Store
eas submit --platform ios
```

---

## 🔐 Security Checklist

Before going to production:

- [ ] Change all JWT secrets (min 64 chars random)
- [ ] Use Razorpay production keys
- [ ] Enable MongoDB Atlas IP whitelist (only your server IP)
- [ ] Set `NODE_ENV=production`
- [ ] Configure Firebase with production credentials
- [ ] Enable SSL certificate (HTTPS only)
- [ ] Set `CORS` to only your app domain
- [ ] Enable MongoDB Atlas backups
- [ ] Set up log monitoring (CloudWatch / Papertrail)
- [ ] Configure rate limiting to stricter values in production
- [ ] Add Sentry for error tracking

---

## 📊 API Endpoints Reference

```
POST   /api/auth/register          Register new user
POST   /api/auth/login             Email/password login
POST   /api/auth/google            Google OAuth login
POST   /api/auth/refresh           Refresh access token
POST   /api/auth/logout            Logout
GET    /api/auth/me                Get current user

GET    /api/advocates              List advocates (filterable)
GET    /api/advocates/nearby       Nearby by lat/lng
GET    /api/advocates/:id          Single advocate
GET    /api/advocates/specializations  All specializations
GET    /api/advocates/cities       Cities with advocates
POST   /api/advocates/profile      Create/update advocate profile

POST   /api/bookings               Create booking
POST   /api/bookings/confirm-payment  Verify Razorpay payment
GET    /api/bookings/my            Client's bookings
GET    /api/bookings/advocate      Advocate's bookings
PATCH  /api/bookings/:id/status    Update booking status

POST   /api/payments/create-order  Create Razorpay order

GET    /api/chats                  My chat list
GET    /api/chats/:id/messages     Messages in chat
POST   /api/chats/:id/messages     Send message (REST)

GET    /api/reviews                Get reviews
POST   /api/reviews                Post review

POST   /api/ai/legal-advice        AI legal question
POST   /api/ai/fir-draft           Generate FIR draft
POST   /api/ai/chat                AI chat with context

POST   /api/uploads/avatar         Upload avatar image
POST   /api/uploads/document       Upload document

GET    /api/admin/stats            Dashboard stats
GET    /api/admin/advocates/pending  Pending advocates
PATCH  /api/admin/advocates/:id/verify  Approve/reject
GET    /api/admin/users            All users
```

---

## 🧪 Testing

```bash
# Backend
cd backend
npm test

# Test with seed data
curl http://localhost:5000/health
curl http://localhost:5000/api/advocates/nearby?lat=23.18&lng=79.98
```

---

## 🌍 Indian Market Features

- **Razorpay** for UPI, cards, net banking (most used in India)
- **Default location: Jabalpur, MP** (fallback when GPS denied)
- **INR currency** throughout
- **Hindi + English** in FIR generator
- **Indian bar council number** field on advocate profile
- **Seed data** with MP advocates (Jabalpur, Bhopal, Indore)
- **MSG91** integration ready for OTP (configure MOBILE_API_KEY)

---

## 🔜 Phase 2 Features

1. Video consultation (Agora/Jitsi)
2. MSG91 phone OTP
3. DigiLocker integration
4. Advocate wallet & withdrawal
5. Admin web dashboard (React)
6. PWA support
7. Multi-language (Hindi, Marathi, Gujarati)
8. AI contract analyser
9. Court date reminders
10. Lawyer verification via Bar Council API
