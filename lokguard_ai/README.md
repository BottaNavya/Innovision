# LokGuard AI

LokGuard AI is a React + Vite app with Firebase Phone Authentication support.

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
