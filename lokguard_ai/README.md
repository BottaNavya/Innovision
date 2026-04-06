# LokGuard - TinyBheema

LokGuard's TinyBheema provides affordable, on-demand micro-insurance tailored for gig workers, ensuring financial protection anytime, anywhere.

This is a React + Vite app with Firebase authentication support.

## 1. Install dependencies

```bash
npm install
```

## 2. Register Web App in Firebase

1. Open Firebase Console.
2. Create/select your Firebase project.
3. Go to Project settings > General.
4. Under Your apps, click Web app (</>) and register this app.
5. Copy the Firebase config values.

## 3. Configure environment variables

Copy .env.example to .env and paste your Firebase values:

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Required keys:

- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_OTP_API_BASE_URL (optional when using Firebase callable fallback)

## 4. Enable Phone Auth in Firebase

1. Go to Authentication > Sign-in method.
2. Enable Phone provider.
3. Add your testing phone numbers (recommended for development).

## 5. Add authorized domains

In Authentication settings, add localhost to Authorized domains for local testing.

## 6. Run the app

```bash
npm run dev
```

The app reads Firebase config from [src/firebase.js](src/firebase.js). If config is missing, it falls back to demo auth mode in [src/pages/Auth.jsx](src/pages/Auth.jsx).

### Vercel deployment notes

- Set all `VITE_FIREBASE_*` variables in the Vercel project settings.
- Set `VITE_OTP_API_BASE_URL` to your deployed Firebase Functions URL, for example `https://<region>-<project-id>.cloudfunctions.net/emailOtpApi`.
- If this URL is missing or blocked by network/CORS, the app falls back to Firebase callable functions (`sendEmailOtp`, `verifyEmailOtp`) when Firebase is configured.
- Add your Vercel domain to Firebase Authentication authorized domains.
- Deploy the Firebase backend separately; Vercel only serves the frontend in this repo.

## 7. Email OTP API (Node.js + Firebase Functions)

Backend API is available in [functions/index.js](functions/index.js) using Firebase Functions.

### Configure Gmail SMTP

Copy [functions/.env.example](functions/.env.example) to `functions/.env` and set values:

- `GMAIL_USER`
- `GMAIL_APP_PASSWORD` (Gmail app password)
- `GMAIL_FROM` (optional display sender)

The functions code also accepts the older `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM` names, but `GMAIL_*` is the preferred set for Firebase deployment.

### OTP behavior

- Generates a 6-digit OTP
- Stores hashed OTP in Firestore collection `emailOtps`
- OTP expires in 5 minutes
- Basic attempt limiting is included

### API endpoints

Function: `emailOtpApi`

1. `POST /send-otp`
	 Body:

	 ```json
	 {
		 "email": "user@example.com"
	 }
	 ```

2. `POST /verify-otp`
	 Body:

	 ```json
	 {
		 "email": "user@example.com",
		 "otp": "123456"
	 }
	 ```

When deployed on Firebase Functions, call routes like:

- `https://<region>-<project-id>.cloudfunctions.net/emailOtpApi/send-otp`
- `https://<region>-<project-id>.cloudfunctions.net/emailOtpApi/verify-otp`

## 8. Express Email OTP API (Hackathon mode)

A simple standalone Node.js API is available in [functions/otp-server.js](functions/otp-server.js).

### Setup

1. Copy [functions/.env.example](functions/.env.example) to `functions/.env`.
2. Set `EMAIL_USER` and `EMAIL_PASS` (Gmail app password).
3. Start server:

```bash
cd functions
npm run otp-api
```

### Endpoints

1. `POST /send-otp`

```json
{
	"email": "user@example.com"
}
```

2. `POST /verify-otp`

```json
{
	"email": "user@example.com",
	"otp": "123456"
}
```

OTP is a 6-digit code, stored in memory with 5-minute expiry.
