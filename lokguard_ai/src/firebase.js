import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

// Configure these values in your Vite environment variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredConfigKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]

const hasRequiredConfig = requiredConfigKeys.every((key) => {
  const value = firebaseConfig[key]
  return typeof value === 'string' && value.trim().length > 0
})

let app = null
let auth = null
let db = null
let storage = null
let functions = null
let analytics = null
let firebaseSetupError = ''

if (!hasRequiredConfig) {
  firebaseSetupError =
    'Firebase config is missing. Add VITE_FIREBASE_* values in your .env file.'
} else {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    storage = getStorage(app)
    functions = getFunctions(app)

    // Analytics is optional and only available in browser contexts.
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      try {
        analytics = getAnalytics(app)
      } catch {
        analytics = null
      }
    }
  } catch (error) {
    firebaseSetupError = error?.message || 'Firebase initialization failed.'
  }
}

export { auth, db, storage, functions, app, analytics, firebaseSetupError }
export const isFirebaseConfigured = Boolean(auth)
