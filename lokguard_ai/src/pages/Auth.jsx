import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import GigIllustration from '../components/GigIllustration'
import { auth, db } from '../firebase'
import '../App.css'

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const generateCaptchaCode = (length = 5) => {
  let next = ''
  for (let i = 0; i < length; i += 1) {
    next += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)]
  }
  return next
}

export default function Auth() {
  const DEMO_USERS_KEY = 'lokguard_demo_users'
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [authStatus, setAuthStatus] = useState('')
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    location: '',
    password: '',
  })
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptchaCode())
  const [captchaInput, setCaptchaInput] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshCaptcha = () => {
    setCaptchaCode(generateCaptchaCode())
    setCaptchaInput('')
  }

  const getFirebaseAuthErrorMessage = (error) => {
    const code = error?.code || ''

    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.'
    }

    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters.'
    }

    if (code === 'auth/email-already-in-use') {
      return 'This account already exists. Please login instead.'
    }

    if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password.'
    }

    return error?.message || 'Authentication failed. Please try again.'
  }

  const persistUserSession = ({ name, phone = '', email = '', location, uid = 'demo-user' }) => {
    const userData = {
      name,
      phone,
      email,
      location,
    }

    localStorage.setItem('isLoggedIn', 'true')
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem(
      'userSession',
      JSON.stringify({
        uid,
        phone,
        verifiedAt: new Date().toISOString(),
      })
    )
    window.dispatchEvent(new Event('lokguard-auth-changed'))
  }

  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const getDemoUsers = () => {
    const raw = localStorage.getItem(DEMO_USERS_KEY)
    if (!raw) return {}

    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed ? parsed : {}
    } catch {
      return {}
    }
  }

  const setDemoUsers = (users) => {
    localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users))
  }

  const getStoredUid = () => {
    try {
      const session = JSON.parse(localStorage.getItem('userSession') || '{}')
      return session.uid || ''
    } catch {
      return ''
    }
  }

  const loadUserProfile = async (uid) => {
    if (!db || !uid) return null

    try {
      const snap = await getDoc(doc(db, 'users', uid))
      return snap.exists() ? snap.data() : null
    } catch {
      return null
    }
  }

  const saveUserProfile = async (uid, profile) => {
    if (!db || !uid) return

    const snap = await getDoc(doc(db, 'users', uid))
    const isNew = !snap.exists()

    await setDoc(
      doc(db, 'users', uid),
      {
        ...profile,
        updatedAt: serverTimestamp(),
        ...(isNew ? { createdAt: serverTimestamp() } : {}),
      },
      { merge: true }
    )
  }

  const handleModeChange = (nextMode) => {
    setMode(nextMode)
    setAuthStatus('')
    setAuthError('')
    refreshCaptcha()
  }

  const handlePasswordLogin = async () => {
    const email = loginEmail.trim().toLowerCase()
    if (!email) {
      setAuthError('Please enter your email address.')
      return false
    }

    if (!loginPassword.trim()) {
      setAuthError('Please enter your password.')
      return false
    }

    if (!isEmail(email)) {
      setAuthError('Please enter a valid email address.')
      return false
    }

    if (auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, loginPassword)
      const firebaseUser = userCredential.user
      const firestoreProfile = (await loadUserProfile(firebaseUser.uid)) || {}
      const localUser = JSON.parse(localStorage.getItem('user') || '{}')

      persistUserSession({
        name: firestoreProfile.name || localUser.name || 'LokGuard User',
        phone: firestoreProfile.phone || localUser.phone || '',
        email: firestoreProfile.email || localUser.email || email,
        location: firestoreProfile.location || localUser.location || 'Mumbai, India',
        uid: firebaseUser.uid,
      })

      return true
    }

    const users = getDemoUsers()
    const account = users[email]
    if (!account || account.password !== loginPassword) {
      setAuthError('Invalid email or password.')
      return false
    }

    persistUserSession({
      name: account.name,
      phone: account.phone || '',
      email: account.email || email,
      location: account.location,
      uid: account.uid,
    })

    return true
  }

  const handleLogin = async () => {
    setAuthStatus('')
    setAuthError('')

    if (!captchaInput.trim()) {
      setAuthError('Please enter the CAPTCHA code.')
      return
    }

    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      setAuthError('Captcha does not match. Please try again.')
      refreshCaptcha()
      return
    }

    try {
      setIsSubmitting(true)
      const success = await handlePasswordLogin()

      if (!mountedRef.current || !success) return

      setAuthStatus('Login successful. Redirecting to dashboard...')
      refreshCaptcha()
      setTimeout(() => navigate('/dashboard'), 600)
    } catch (error) {
      setAuthError(getFirebaseAuthErrorMessage(error))
      refreshCaptcha()
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  const handleRegister = async () => {
    setAuthStatus('')
    setAuthError('')

    if (!captchaInput.trim()) {
      setAuthError('Please enter the CAPTCHA code.')
      return
    }

    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      setAuthError('Captcha does not match. Please try again.')
      refreshCaptcha()
      return
    }

    const password = registerData.password.trim()
    const userData = {
      name: registerData.name.trim(),
      email: registerData.email.trim().toLowerCase(),
      location: registerData.location.trim(),
    }

    if (!userData.name || !userData.email || !userData.location || !password) {
      setAuthError('Please fill all registration fields.')
      return
    }

    if (password.length < 6) {
      setAuthError('Password should be at least 6 characters.')
      return
    }

    if (!isEmail(userData.email)) {
      setAuthError('Please enter a valid email address.')
      return
    }

    try {
      setIsSubmitting(true)

      if (auth) {
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password)
        const firebaseUser = userCredential.user

        const profile = {
          name: userData.name,
          email: userData.email,
          location: userData.location,
        }

        await saveUserProfile(firebaseUser.uid, profile)
        persistUserSession({
          ...profile,
          uid: firebaseUser.uid,
        })
      } else {
        const users = getDemoUsers()

        if (users[userData.email]) {
          setAuthError('This account already exists. Please login instead.')
          return
        }

        const demoUser = {
          uid: `demo-${Date.now()}`,
          name: userData.name,
          email: userData.email,
          location: userData.location,
          password,
        }

        users[userData.email] = demoUser
        setDemoUsers(users)
        persistUserSession({
          name: demoUser.name,
          phone: '',
          email: demoUser.email,
          location: demoUser.location,
          uid: demoUser.uid,
        })
      }

      setAuthStatus('Account created successfully. Redirecting to dashboard...')
      refreshCaptcha()
      setTimeout(() => {
        navigate('/dashboard')
      }, 800)
    } catch (error) {
      setAuthError(getFirebaseAuthErrorMessage(error))
      refreshCaptcha()
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <div className="page-shell auth-page">
      <section className="auth-layout auth-layout--premium">
        <div className="auth-panel auth-panel--marketing">
          <span className="eyebrow">Secure access</span>
          <h1>Designed like a premium product, built for gig workers.</h1>
          <p>
            LokGuard AI gives users one secure place to sign in, register, and manage
            income protection with a polished, mobile-first flow.
          </p>

          <GigIllustration variant="auth" />
        </div>

        <div className="auth-panel auth-panel--form card">
          <div className="auth-topline">
            <span className="status-badge verified">Protected access</span>
            <span className="auth-help">Quick sign-in</span>
          </div>

          <div className="auth-toggle">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => handleModeChange('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => handleModeChange('register')}
            >
              Register
            </button>
          </div>

          <div className="auth-copy">
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p>
              {mode === 'login'
                ? 'Login with your email and password.'
                : 'Register with your email and a password.'}
            </p>
          </div>

          <form className="auth-form auth-form--premium">
            {mode === 'register' && (
              <label>
                Full name
                <input
                  className="form-input"
                  placeholder="Rajesh Kumar"
                  autoComplete="name"
                  value={registerData.name}
                  onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                />
              </label>
            )}

            {mode === 'register' && (
              <label>
                Email
                <input
                  className="form-input"
                  placeholder="name@email.com"
                  autoComplete="email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                />
              </label>
            )}

            {mode === 'login' && (
              <label>
                Email
                <input
                  className="form-input"
                  placeholder="name@email.com"
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </label>
            )}

            {mode === 'register' && (
              <label>
                Location
                <input
                  className="form-input"
                  placeholder="Mumbai, India"
                  autoComplete="address-level2"
                  value={registerData.location}
                  onChange={(e) => setRegisterData({ ...registerData, location: e.target.value })}
                />
              </label>
            )}

            {mode === 'register' && (
              <label>
                Create password
                <input
                  className="form-input"
                  placeholder="Set a secure password"
                  type="password"
                  autoComplete="new-password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                />
              </label>
            )}

            {mode === 'login' && (
              <label>
                Password
                <input
                  className="form-input"
                  placeholder="Enter your password"
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </label>
            )}

            {authStatus && <p className="auth-status">{authStatus}</p>}
            {authError && <p className="auth-status auth-status-error">{authError}</p>}

            <div className="captcha-block">
              <div className="captcha-header">
                <strong>Verification</strong>
                <button
                  type="button"
                  className="captcha-refresh"
                  onClick={refreshCaptcha}
                  aria-label="Refresh captcha"
                >
                  ↻
                </button>
              </div>
              <p>Enter the code shown below to continue.</p>
              <div className="captcha-code">{captchaCode}</div>
              <input
                className="form-input captcha-input"
                placeholder="Enter verification code"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                maxLength={5}
              />
            </div>

            <button
              className="primary-button auth-submit"
              type="button"
              onClick={mode === 'register' ? handleRegister : handleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
