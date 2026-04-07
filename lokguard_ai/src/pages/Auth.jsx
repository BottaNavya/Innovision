import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GigIllustration from '../components/GigIllustration'
import { fetchUserProfile, resolveLoginEmail } from '../lib/userStore'
import { supabase } from '../supabaseClient'
import '../App.css'

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const generateCaptchaCode = (length = 5) => {
  let next = ''
  for (let i = 0; i < length; i += 1) {
    next += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)]
  }
  return next
}

const extractNameFromEmail = (email = '') => {
  const localPart = email.split('@')[0] || ''
  const cleaned = localPart.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

const resolveDisplayName = (explicitName, email, fallback = 'TinyBheema User') => {
  const fromName = (explicitName || '').trim()
  if (fromName) return fromName

  const fromEmail = extractNameFromEmail(email)
  if (fromEmail) return fromEmail

  return fallback
}

export default function Auth() {
  const navigate = useNavigate()
  const mountedRef = useRef(true)

  const [mode, setMode] = useState('login')
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    confirmPassword: '',
  })
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptchaCode())
  const [captchaInput, setCaptchaInput] = useState('')
  const [authStatus, setAuthStatus] = useState('')
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEmailOtpStep, setShowEmailOtpStep] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationOtp, setVerificationOtp] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

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

  const resetFormState = (nextMode) => {
    setMode(nextMode)
    setAuthStatus('')
    setAuthError('')
    setShowEmailOtpStep(false)
    setVerificationEmail('')
    setVerificationOtp('')
    setCaptchaInput('')
    refreshCaptcha()
  }

  const normalizeInput = (value) => value.trim()
  const normalizeEmail = (value) => value.trim().toLowerCase()
  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  const isPhone = (value) => /^[+\d][\d\s()-]{6,}$/.test(value.trim())

  const persistUserSession = ({
    name,
    phone = '',
    email = '',
    location = 'Mumbai, India',
    gender = '',
    pincode = '',
    occupation = '',
    preferredClaimMethod = 'UPI',
    verification = {},
    documents = {},
    uid,
  }) => {
    let existingUser = {}

    try {
      existingUser = JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      existingUser = {}
    }

    const userData = {
      ...existingUser,
      name,
      phone,
      email,
      location,
      gender,
      pincode,
      occupation: occupation || existingUser.occupation || '',
      preferredClaimMethod: preferredClaimMethod || existingUser.preferredClaimMethod || 'UPI',
      verification: {
        ...(existingUser.verification || {}),
        ...verification,
      },
      documents: {
        ...(existingUser.documents || {}),
        ...documents,
      },
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

  const finalizeSessionFromProfile = async (user, fallbackProfile = {}) => {
    const dbProfile = await fetchUserProfile(user.id).catch(() => null)
    const profile = dbProfile || fallbackProfile

    persistUserSession({
      name: resolveDisplayName(profile?.name, profile?.email || user.email),
      phone: profile?.phone || '',
      email: profile?.email || user.email || '',
      location: profile?.location || 'Mumbai, India',
      gender: profile?.gender || '',
      pincode: profile?.pincode || '',
      occupation: profile?.occupation || '',
      preferredClaimMethod: profile?.preferred_claim_method || profile?.preferredClaimMethod || 'UPI',
      verification: profile?.verification || {},
      documents: profile?.documents || {},
      uid: user.id,
    })
  }

  const ensureCaptcha = () => {
    if (!captchaInput.trim()) {
      setAuthError('Please enter the CAPTCHA code.')
      return false
    }

    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      setAuthError('Captcha does not match. Please try again.')
      refreshCaptcha()
      return false
    }

    return true
  }

  const normalizePhone = (value) => value.replace(/[^\d+]/g, '').trim()

  const registerUser = async () => {
    setAuthStatus('')
    setAuthError('')

    if (!ensureCaptcha()) return

    const name = registerData.name.trim()
    const email = normalizeEmail(registerData.email)
    const phone = normalizePhone(registerData.phone)
    const location = registerData.location.trim()
    const registrationPassword = password.trim()
    const confirmPassword = registerData.confirmPassword.trim()

    if (!name) {
      setAuthError('Enter your full name.')
      return
    }

    if (!isEmail(email)) {
      setAuthError('Enter a valid email address.')
      return
    }

    if (!phone) {
      setAuthError('Enter your phone number.')
      return
    }

    if (!location) {
      setAuthError('Enter your location.')
      return
    }

    if (!registrationPassword) {
      setAuthError('Enter a password.')
      return
    }

    if (registrationPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.')
      return
    }

    if (registrationPassword !== confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }

    try {
      setIsSubmitting(true)

      const { data, error } = await supabase.auth.signUp({
        email,
        password: registrationPassword,
        options: {
          data: {
            name,
            phone,
            location,
          },
        },
      })

      if (error) throw error

      const user = data?.user
      if (!user) {
        throw new Error('Registration succeeded, but the user session was not created.')
      }

      await supabase
        .from('users')
        .upsert(
          {
            id: user.id,
            name,
            email,
            phone,
            location,
            pincode: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )

      if (data.session) {
        await supabase.auth.signOut()
      }

      setAuthStatus('Account created successfully. Please login with email or phone + password.')

      setRegisterData({
        name: '',
        email: '',
        phone: '',
        location: '',
        confirmPassword: '',
      })
      setPassword('')
      refreshCaptcha()
      setMode('login')
    } catch (error) {
      setAuthError(error?.message || 'Registration failed. Please try again.')
      refreshCaptcha()
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  const resolveLoginEmailAddress = async (identifier) => {
    const normalizedIdentifier = normalizeInput(identifier)

    if (isEmail(normalizedIdentifier)) {
      return normalizeEmail(normalizedIdentifier)
    }

    if (!isPhone(normalizedIdentifier)) {
      throw new Error('Enter a valid email address or phone number.')
    }

    const resolvedEmail = await resolveLoginEmail(normalizedIdentifier)
    if (!resolvedEmail) {
      throw new Error('No account was found for that phone number. Please contact support.')
    }

    return normalizeEmail(resolvedEmail)
  }

  const sendEmailVerificationOtp = async (email) => {
    const normalizedEmail = normalizeEmail(email)
    if (!isEmail(normalizedEmail)) {
      setAuthError('Enter a valid email to receive OTP.')
      return false
    }

    try {
      setIsSendingOtp(true)
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      })

      if (error) throw error

      setVerificationEmail(normalizedEmail)
      setVerificationOtp('')
      setShowEmailOtpStep(true)
      setAuthError('')
      setAuthStatus(`OTP sent to ${normalizedEmail}. Enter 7 to 8 digits to verify and continue login.`)
      return true
    } catch (error) {
      setAuthError(error?.message || 'Unable to send verification OTP. Please try again.')
      return false
    } finally {
      if (mountedRef.current) {
        setIsSendingOtp(false)
      }
    }
  }

  const verifyEmailOtpAndContinueLogin = async () => {
    setAuthStatus('')
    setAuthError('')

    const otp = verificationOtp.trim()
    if (!/^\d{7,8}$/.test(otp)) {
      setAuthError('Enter a valid OTP with 7 to 8 digits.')
      return
    }

    try {
      setIsVerifyingOtp(true)
      const { data, error } = await supabase.auth.verifyOtp({
        email: verificationEmail,
        token: otp,
        type: 'email',
      })

      if (error) throw error

      const user = data?.user
      if (!user) {
        throw new Error('Email verified, but login session was not created. Please try password login again.')
      }

      await finalizeSessionFromProfile(user, { email: verificationEmail })

      setShowEmailOtpStep(false)
      setVerificationOtp('')
      setPassword('')
      setLoginIdentifier('')
      setAuthStatus('Email verified and login successful. Redirecting to dashboard...')
      refreshCaptcha()
      navigate('/dashboard')
    } catch (error) {
      setAuthError(error?.message || 'OTP verification failed. Please try again.')
    } finally {
      if (mountedRef.current) {
        setIsVerifyingOtp(false)
      }
    }
  }

  const handleLogin = async () => {
    setAuthStatus('')
    setAuthError('')

    if (!ensureCaptcha()) return

    const identifier = normalizeInput(loginIdentifier)
    if (!identifier) {
      setAuthError('Enter your email address or phone number.')
      return
    }

    if (!password.trim()) {
      setAuthError('Enter your password.')
      return
    }

    try {
      setIsSubmitting(true)
      const email = await resolveLoginEmailAddress(identifier)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      })

      if (error) throw error

      const user = data?.user
      if (!user) {
        throw new Error('Unable to verify your account. Please try again.')
      }

      await finalizeSessionFromProfile(user, { email })

      setAuthStatus('Login successful. Redirecting to dashboard...')
      setShowEmailOtpStep(false)
      setVerificationEmail('')
      setVerificationOtp('')
      setPassword('')
      setLoginIdentifier('')
      refreshCaptcha()
      navigate('/dashboard')
    } catch (error) {
      const rawMessage = String(error?.message || '')
      if (/email not confirmed|email_not_confirmed/i.test(rawMessage)) {
        const emailForOtp = await resolveLoginEmailAddress(identifier).catch(() => '')
        if (emailForOtp) {
          await sendEmailVerificationOtp(emailForOtp)
        } else {
          setAuthError('Email not confirmed. Please login with email format to receive verification OTP.')
        }
      } else {
        setAuthError(error?.message || 'Login failed. Please check your credentials and try again.')
      }
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
            TinyBheema by LokGuard gives users one secure place to sign in and manage
            on-demand micro-insurance with a polished, mobile-first flow.
          </p>

          <GigIllustration variant="auth" />
        </div>

        <div className="auth-panel auth-panel--form card">
          <div className="auth-topline">
            <span className="status-badge verified">Protected access</span>
            <span className="auth-help">{mode === 'login' ? 'Password sign-in' : 'Create account'}</span>
          </div>

          <div className="auth-toggle">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => resetFormState('login')}>
              Login
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => resetFormState('register')}>
              Register
            </button>
          </div>

          <div className="auth-copy">
            <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p>
              {mode === 'login'
                ? 'Enter your email or phone number and password to continue.'
                : 'Create your account with name, email, phone, location, and password.'}
            </p>
          </div>

          <form className="auth-form auth-form--premium">
            {mode === 'register' ? (
              <>
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

                <label>
                  Phone number
                  <input
                    className="form-input"
                    placeholder="9876543210"
                    autoComplete="tel"
                    value={registerData.phone}
                    onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                  />
                </label>

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
              </>
            ) : (
              <label>
                Email or phone
                <input
                  className="form-input"
                  placeholder="name@email.com or 9876543210"
                  autoComplete="username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                />
              </label>
            )}

            <label>
              Password
              <input
                className="form-input"
                placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {mode === 'register' && (
              <label>
                Confirm password
                <input
                  className="form-input"
                  placeholder="Re-enter your password"
                  type="password"
                  autoComplete="new-password"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                />
              </label>
            )}

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

            {authStatus && <p className="auth-status">{authStatus}</p>}
            {authError && <p className="auth-status auth-status-error">{authError}</p>}

            {mode === 'login' && showEmailOtpStep && (
              <div className="captcha-block" style={{ marginTop: '0.25rem' }}>
                <div className="captcha-header">
                  <strong>Email OTP verification</strong>
                  <button
                    type="button"
                    className="captcha-refresh"
                    onClick={() => sendEmailVerificationOtp(verificationEmail)}
                    aria-label="Resend OTP"
                    disabled={isSendingOtp}
                  >
                    {isSendingOtp ? '...' : '↻'}
                  </button>
                </div>
                <p>Enter the OTP sent to {verificationEmail}.</p>
                <input
                  className="form-input captcha-input"
                  placeholder="Enter 7 to 8 digit OTP"
                  value={verificationOtp}
                  onChange={(e) => setVerificationOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  inputMode="numeric"
                  maxLength={8}
                />
                <button
                  className="primary-button auth-submit"
                  type="button"
                  onClick={verifyEmailOtpAndContinueLogin}
                  disabled={isVerifyingOtp}
                  style={{ marginTop: '0.75rem' }}
                >
                  {isVerifyingOtp ? 'Verifying...' : 'Verify OTP & Continue'}
                </button>
              </div>
            )}

            <button
              className="primary-button auth-submit"
              type="button"
              onClick={mode === 'login' ? handleLogin : registerUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
