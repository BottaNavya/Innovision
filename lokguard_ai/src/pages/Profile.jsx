import { useEffect, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import Card from '../components/Card'
import { auth, db, storage } from '../firebase'
import '../App.css'

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

const resolveDisplayName = (explicitName, email) => {
  const fromName = (explicitName || '').trim()
  if (fromName) return fromName

  const fromEmail = extractNameFromEmail(email)
  if (fromEmail) return fromEmail

  return 'TinyBheema User'
}

const otpApiBaseUrl = (import.meta.env.VITE_OTP_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '')

export default function Profile() {
  const PROFILE_DRAFT_KEY = 'lokguard_profile_draft'
  const PROFILE_PENDING_SYNC_KEY = 'lokguard_profile_pending_sync'

  const [profile, setProfile] = useState({
    name: 'TinyBheema User',
    phone: '',
    email: '',
    location: 'Mumbai, India',
    pincode: '',
    gender: '',
    occupation: '',
    preferredClaimMethod: '',
  })
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    pincode: '',
    gender: '',
    occupation: '',
    preferredClaimMethod: 'UPI',
  })
  const [activeEditSection, setActiveEditSection] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false)
  const [isCheckingEmailOtp, setIsCheckingEmailOtp] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [emailOtpCode, setEmailOtpCode] = useState('')
  const [emailOtpSentTo, setEmailOtpSentTo] = useState('')
  const [idProofFile, setIdProofFile] = useState(null)
  const [aadhaarFile, setAadhaarFile] = useState(null)
  const [idProofUrl, setIdProofUrl] = useState('')
  const [aadhaarUrl, setAadhaarUrl] = useState('')
  const [formStatus, setFormStatus] = useState('')
  const [formError, setFormError] = useState('')
  const [memberSince, setMemberSince] = useState('Recently')
  const [planSummary, setPlanSummary] = useState({
    planName: 'No active plan',
    coverageAmount: 'Not set',
    price: 'Not set',
  })
  const [autoClaimSettings, setAutoClaimSettings] = useState({
    autoClaim: true,
    smartDetection: true,
    manualReview: false,
  })
  const OTP_REQUEST_TIMEOUT_MS = 15000

  useEffect(() => {
    try {
      const storedSettings = JSON.parse(localStorage.getItem('lokguard_auto_claim_settings') || '{}')
      if (storedSettings && typeof storedSettings === 'object') {
        setAutoClaimSettings((prev) => ({
          ...prev,
          ...storedSettings,
        }))
      }
    } catch {
      // Ignore malformed local settings.
    }

    const getStoredUid = () => {
      try {
        const session = JSON.parse(localStorage.getItem('userSession') || '{}')
        return session.uid || ''
      } catch {
        return ''
      }
    }

    const formatMemberSince = (value) => {
      if (!value) return 'Recently'

      if (typeof value?.toDate === 'function') {
        return value.toDate().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      }

      const asDate = new Date(value)
      if (Number.isNaN(asDate.getTime())) return 'Recently'
      return asDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    }

    const loadProfile = async () => {
      let localUser = {}
      let localPlan = {}

      try {
        localUser = JSON.parse(localStorage.getItem('user') || '{}')
      } catch {
        localUser = {}
      }

      try {
        localPlan = JSON.parse(localStorage.getItem('policyPlan') || '{}')
      } catch {
        localPlan = {}
      }

      setProfile({
        name: resolveDisplayName(localUser.name, localUser.email),
        phone: localUser.phone || '',
        email: localUser.email || '',
        location: localUser.location || 'Mumbai, India',
        pincode: localUser.pincode || '',
        gender: localUser.gender || '',
        occupation: localUser.occupation || '',
        preferredClaimMethod: localUser.preferredClaimMethod || 'UPI',
      })

      setIdProofUrl(localUser?.documents?.idProofUrl || '')
      setAadhaarUrl(localUser?.documents?.aadhaarUrl || '')
      setIsEmailVerified(Boolean(auth?.currentUser?.emailVerified || localUser?.verification?.emailVerified))

      setEditData({
        name: localUser.name || '',
        phone: localUser.phone || '',
        email: localUser.email || '',
        location: localUser.location || 'Mumbai, India',
        pincode: localUser.pincode || '',
        gender: localUser.gender || '',
        occupation: localUser.occupation || '',
        preferredClaimMethod: localUser.preferredClaimMethod || 'UPI',
      })

      setPlanSummary({
        planName: localPlan.planName || 'No active plan',
        coverageAmount: localPlan.coverageAmount || 'Not set',
        price: localPlan.price || 'Not set',
      })

      const uid = auth?.currentUser?.uid || getStoredUid()
      if (!db || !uid) return

      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (!snap.exists()) return

        const data = snap.data() || {}
        const activePlan = data.activePlan || {}

        setProfile({
          name: resolveDisplayName(data.name || localUser.name, data.email || localUser.email),
          phone: data.phone || localUser.phone || '',
          email: data.email || localUser.email || '',
          location: data.location || localUser.location || 'Mumbai, India',
          pincode: data.pincode || localUser.pincode || '',
          gender: data.gender || localUser.gender || '',
          occupation: data.occupation || localUser.occupation || '',
          preferredClaimMethod: data.preferredClaimMethod || localUser.preferredClaimMethod || 'UPI',
        })

        setIdProofUrl(data?.documents?.idProofUrl || localUser?.documents?.idProofUrl || '')
        setAadhaarUrl(data?.documents?.aadhaarUrl || localUser?.documents?.aadhaarUrl || '')
        setIsEmailVerified(Boolean(auth?.currentUser?.emailVerified || data?.verification?.emailVerified || localUser?.verification?.emailVerified))

        setEditData({
          name: data.name || localUser.name || '',
          phone: data.phone || localUser.phone || '',
          email: data.email || localUser.email || '',
          location: data.location || localUser.location || 'Mumbai, India',
          pincode: data.pincode || localUser.pincode || '',
          gender: data.gender || localUser.gender || '',
          occupation: data.occupation || localUser.occupation || '',
          preferredClaimMethod: data.preferredClaimMethod || localUser.preferredClaimMethod || 'UPI',
        })

        setMemberSince(formatMemberSince(data.createdAt))

        setPlanSummary({
          planName: activePlan.planName || localPlan.planName || 'No active plan',
          coverageAmount: activePlan.coverageAmount || localPlan.coverageAmount || 'Not set',
          price: activePlan.price || localPlan.price || 'Not set',
        })
      } catch {
        setFormStatus('Using your saved profile data.')
      }
    }

    loadProfile()
  }, [])

  const getStoredUid = () => {
    try {
      const session = JSON.parse(localStorage.getItem('userSession') || '{}')
      return session.uid || ''
    } catch {
      return ''
    }
  }

  const handleEditChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }))

    if (field === 'email') {
      setIsEmailVerified(false)
      setEmailOtpCode('')
      setEmailOtpSentTo('')
      setIsSendingEmailOtp(false)
      setIsCheckingEmailOtp(false)
    }

    setFormError('')
    setFormStatus('')
  }

  const fetchWithTimeout = async (url, options = {}) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), OTP_REQUEST_TIMEOUT_MS)

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const persistEmailVerifiedState = async (email) => {
    setIsEmailVerified(true)

    const normalizedEmail = String(email || '').trim().toLowerCase()

    try {
      const localUser = JSON.parse(localStorage.getItem('user') || '{}')
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...localUser,
          email: normalizedEmail || localUser.email || '',
          verification: {
            ...(localUser.verification || {}),
            emailVerified: true,
            emailVerificationStatus: 'verified',
            emailVerifiedAt: new Date().toISOString(),
          },
        })
      )
    } catch {
      // Ignore local cache failures.
    }

    const uid = auth?.currentUser?.uid || getStoredUid()
    if (uid && db) {
      try {
        await setDoc(
          doc(db, 'users', uid),
          {
            email: normalizedEmail,
            verification: {
              emailVerified: true,
              emailVerificationStatus: 'verified',
              emailVerifiedAt: serverTimestamp(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )
      } catch {
        // Keep local verification status even if remote update fails.
      }
    }
  }

  const handleEmailVerification = async () => {
    setFormError('')
    setFormStatus('')

    const email = (activeEditSection === 'identity' ? editData.email : profile.email).trim().toLowerCase()
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

    if (!isEmailValid) {
      setFormError('Enter a valid email before sending OTP.')
      return
    }

    setIsSendingEmailOtp(true)

    try {
      const response = await fetchWithTimeout(`${otpApiBaseUrl}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to send OTP.')
      }

      setEmailOtpSentTo(email)
      setEmailOtpCode('')
      setFormStatus(`OTP sent to ${email}. Please check inbox and spam.`)
    } catch (error) {
      setFormError(error?.message || 'Failed to send OTP. Ensure OTP API is running.')
    } finally {
      setIsSendingEmailOtp(false)
    }
  }

  const isOtpReadyToVerify =
    !isEmailVerified &&
    emailOtpSentTo === (activeEditSection === 'identity' ? editData.email : profile.email).trim().toLowerCase() &&
    /^\d{6}$/.test(emailOtpCode.trim())

  const checkVerificationStatus = async () => {
    setFormError('')
    setFormStatus('')

    const email = (activeEditSection === 'identity' ? editData.email : profile.email).trim().toLowerCase()
    const otp = emailOtpCode.trim()

    if (!emailOtpSentTo || emailOtpSentTo !== email) {
      setFormError('Send OTP first for the current email address.')
      return
    }

    if (!/^\d{6}$/.test(otp)) {
      setFormError('Enter a valid 6-digit OTP.')
      return
    }

    setIsCheckingEmailOtp(true)

    try {
      const response = await fetchWithTimeout(`${otpApiBaseUrl}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'OTP verification failed.')
      }

      await persistEmailVerifiedState(email)
      setEmailOtpCode('')
      setEmailOtpSentTo('')
      setFormStatus('Email verified successfully using OTP.')
    } catch (error) {
      const isAbort = error?.name === 'AbortError'
      setFormError(isAbort ? 'Verification timed out. Please try again.' : (error?.message || 'OTP verification failed.'))
    } finally {
      setIsCheckingEmailOtp(false)
    }
  }

  useEffect(() => {
    if (!activeEditSection) return

    localStorage.setItem(
      PROFILE_DRAFT_KEY,
      JSON.stringify({
        editData,
        idProofUrl,
        aadhaarUrl,
      })
    )
  }, [
    activeEditSection,
    editData,
    idProofUrl,
    aadhaarUrl,
  ])

  const applyDraftIfAvailable = () => {
    try {
      const raw = localStorage.getItem(PROFILE_DRAFT_KEY)
      if (!raw) return false

      const draft = JSON.parse(raw)
      if (!draft || typeof draft !== 'object') return false

      if (draft.editData) {
        setEditData((prev) => ({ ...prev, ...draft.editData }))
      }

      setIdProofUrl(draft.idProofUrl || '')
      setAadhaarUrl(draft.aadhaarUrl || '')
      return true
    } catch {
      return false
    }
  }

  const saveProfileLocallyAsPending = ({
    name,
    email,
    phone,
    location,
    pincode,
    gender,
    occupation,
    preferredClaimMethod,
    verification,
    documents,
  }) => {
    const localUser = JSON.parse(localStorage.getItem('user') || '{}')
    const nextUser = {
      ...localUser,
      name,
      email,
      phone,
      location,
      pincode,
      gender,
      occupation,
      preferredClaimMethod,
      verification,
      documents,
      pendingSync: true,
      updatedAt: new Date().toISOString(),
    }

    localStorage.setItem('user', JSON.stringify(nextUser))
    localStorage.setItem(
      PROFILE_PENDING_SYNC_KEY,
      JSON.stringify({
        ...nextUser,
        pendingSavedAt: new Date().toISOString(),
      })
    )
    localStorage.removeItem(PROFILE_DRAFT_KEY)

    setProfile({
      name,
      email,
      phone,
      location,
      pincode,
      gender,
      occupation,
      preferredClaimMethod,
    })
  }

  const normalizePhone = (phone) => {
    const trimmed = phone.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('+')) return trimmed
    return `+${trimmed}`
  }

  const resetEditDataFromProfile = () => {
    setEditData({
      name: profile.name || '',
      phone: profile.phone || '',
      email: profile.email || '',
      location: profile.location || 'Mumbai, India',
      pincode: profile.pincode || '',
      gender: profile.gender || '',
      occupation: profile.occupation || '',
      preferredClaimMethod: profile.preferredClaimMethod || 'UPI',
    })
  }

  const startSectionEdit = (section) => {
    setFormError('')
    setFormStatus('')
    setActiveEditSection(section)
    applyDraftIfAvailable()
  }

  const cancelSectionEdit = () => {
    setFormError('')
    setFormStatus('')
    setActiveEditSection(null)
    setIsSaving(false)
    localStorage.removeItem(PROFILE_DRAFT_KEY)
    resetEditDataFromProfile()
  }


  const handleSaveProfile = async (section = 'all') => {
    setFormError('')
    setFormStatus('')

    const name = editData.name.trim()
    const email = editData.email.trim().toLowerCase()
    const phone = editData.phone.trim()
    const location = editData.location.trim()
    const pincode = editData.pincode.trim()
    const gender = editData.gender.trim()
    const occupation = editData.occupation.trim()
    const preferredClaimMethod = editData.preferredClaimMethod.trim()

    const shouldSaveIdentity = section === 'all' || section === 'identity'
    const shouldSaveWork = section === 'all' || section === 'work'
    const shouldSaveSummary = section === 'all' || section === 'summary'

    if (shouldSaveIdentity && (!name || !email)) {
      setFormError('Name and email are required for Identity.')
      return
    }

    if (shouldSaveWork && (!location || !pincode)) {
      setFormError('Location and pincode are required for Work zone.')
      return
    }

    if (shouldSaveWork && pincode && !/^[1-9]\d{5}$/.test(pincode)) {
      setFormError('Enter a valid 6-digit pincode.')
      return
    }

    const isEmailValid = !shouldSaveIdentity || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (shouldSaveIdentity && !isEmailValid) {
      setFormError('Please enter a valid email address.')
      return
    }

    const normalizedPhone = phone ? (phone.startsWith('+') ? phone : `+${phone}`) : ''
    if (normalizedPhone) {
      const isPhoneValid = /^\+[1-9]\d{9,14}$/.test(normalizedPhone)
      if (!isPhoneValid) {
        setFormError('Use international phone format, for example +919876543210.')
        return
      }
    }

    const uid = auth?.currentUser?.uid || getStoredUid()
    if (!uid) {
      setFormError('Session not found. Please login again to save profile.')
      return
    }

    const effectivePhone = shouldSaveIdentity ? normalizedPhone : profile.phone
    const hasPhone = Boolean(effectivePhone)

    const payload = {
      name: shouldSaveIdentity ? name : profile.name,
      email: shouldSaveIdentity ? email : profile.email,
      phone: shouldSaveIdentity ? normalizedPhone : profile.phone,
      location: shouldSaveWork ? location : profile.location,
      pincode: shouldSaveWork ? pincode : profile.pincode,
      gender: shouldSaveIdentity ? gender : profile.gender,
      occupation: shouldSaveWork ? (occupation || 'Gig worker') : profile.occupation,
      preferredClaimMethod: shouldSaveSummary || shouldSaveWork
        ? (preferredClaimMethod || 'UPI')
        : profile.preferredClaimMethod,
      verification: {
        phoneVerified: false,
        phoneVerificationStatus: hasPhone ? 'not-enabled' : 'not-provided',
        phoneVerifiedAt: null,
        emailVerified: Boolean(isEmailVerified || auth?.currentUser?.emailVerified),
        emailVerificationStatus: isEmailVerified || auth?.currentUser?.emailVerified ? 'verified' : 'pending',
        occupationVerificationStatus: (shouldSaveWork ? occupation : profile.occupation) ? 'pending' : 'not-required',
      },
      updatedAt: serverTimestamp(),
    }

    setIsSaving(true)
    let localUser = {}
    const sectionLabel = section === 'identity' ? 'identity' : section === 'work' ? 'work zone' : 'summary'

    try {
      localUser = JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      localUser = {}
    }

    try {
      const userRef = doc(db, 'users', uid)

      let finalIdProofUrl = idProofUrl
      let finalAadhaarUrl = aadhaarUrl

      if (shouldSaveWork && occupation) {
        if (!idProofFile && !finalIdProofUrl) {
          setFormError('Upload ID proof for occupation verification.')
          setIsSaving(false)
          return
        }

        if (!aadhaarFile && !finalAadhaarUrl) {
          setFormError('Upload Aadhaar for occupation verification.')
          setIsSaving(false)
          return
        }
      }

      const optimisticProfile = {
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        location: payload.location,
        pincode: payload.pincode,
        gender: payload.gender,
        occupation: payload.occupation,
        preferredClaimMethod: payload.preferredClaimMethod,
      }

      // Optimistic update: show new values immediately while background sync continues
      setProfile(optimisticProfile)
      setEditData(optimisticProfile)
      setActiveEditSection(null)
      localStorage.removeItem(PROFILE_DRAFT_KEY)
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...localUser,
          ...optimisticProfile,
          documents: {
            idProofUrl: finalIdProofUrl || idProofUrl || '',
            aadhaarUrl: finalAadhaarUrl || aadhaarUrl || '',
          },
          pendingSync: true,
          updatedAt: new Date().toISOString(),
        })
      )
      // Optimistic update complete, now sync in background
      await new Promise((resolve) => setTimeout(resolve, 0))
      setIsSaving(false)

      if (shouldSaveWork && occupation && storage) {
        const uploadTasks = []

        if (idProofFile) {
          const safeName = idProofFile.name.replace(/\s+/g, '_')
          const idPath = `userDocuments/${uid}/idProof_${Date.now()}_${safeName}`
          uploadTasks.push(
            uploadBytes(ref(storage, idPath), idProofFile).then(async (idSnapshot) => ({
              type: 'idProof',
              url: await getDownloadURL(idSnapshot.ref),
            }))
          )
        }

        if (aadhaarFile) {
          const safeName = aadhaarFile.name.replace(/\s+/g, '_')
          const aadhaarPath = `userDocuments/${uid}/aadhaar_${Date.now()}_${safeName}`
          uploadTasks.push(
            uploadBytes(ref(storage, aadhaarPath), aadhaarFile).then(async (aadhaarSnapshot) => ({
              type: 'aadhaar',
              url: await getDownloadURL(aadhaarSnapshot.ref),
            }))
          )
        }

        const uploadResults = await Promise.all(uploadTasks)
        uploadResults.forEach((result) => {
          if (result.type === 'idProof') {
            finalIdProofUrl = result.url
          }

          if (result.type === 'aadhaar') {
            finalAadhaarUrl = result.url
          }
        })
      }

      payload.documents = {
        idProofUrl: finalIdProofUrl || idProofUrl || '',
        aadhaarUrl: finalAadhaarUrl || aadhaarUrl || '',
        submittedAt: shouldSaveWork && occupation ? serverTimestamp() : null,
      }

      await setDoc(userRef, payload, { merge: true })

      localStorage.setItem(
        'user',
        JSON.stringify({
          ...localUser,
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          location: payload.location,
          pincode: payload.pincode,
          gender: payload.gender,
          occupation: payload.occupation,
          preferredClaimMethod: payload.preferredClaimMethod,
          verification: {
            phoneVerified: false,
            phoneVerificationStatus: hasPhone ? 'not-enabled' : 'not-provided',
            emailVerified: Boolean(isEmailVerified || auth?.currentUser?.emailVerified),
            emailVerificationStatus: isEmailVerified || auth?.currentUser?.emailVerified ? 'verified' : 'pending',
            occupationVerificationStatus: occupation ? 'pending' : 'not-required',
          },
          documents: {
            idProofUrl: finalIdProofUrl || '',
            aadhaarUrl: finalAadhaarUrl || '',
          },
          pendingSync: false,
          updatedAt: new Date().toISOString(),
        })
      )
      localStorage.removeItem(PROFILE_PENDING_SYNC_KEY)

      setIdProofUrl(finalIdProofUrl || '')
      setAadhaarUrl(finalAadhaarUrl || '')
      setIdProofFile(null)
      setAadhaarFile(null)

      setFormStatus(`${sectionLabel} updated successfully.`)
      window.dispatchEvent(new Event('lokguard-auth-changed'))
    } catch (error) {
      const code = error?.code || ''

      if (code === 'permission-denied' || code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
        setFormError('Unable to save your changes. Please check your permissions and try again.')
      } else if (
        code === 'unavailable' ||
        code === 'failed-precondition' ||
        code === 'deadline-exceeded' ||
        error?.message?.toLowerCase().includes('offline')
      ) {
        const documents = {
          idProofUrl: idProofUrl || '',
          aadhaarUrl: aadhaarUrl || '',
        }
        const verification = {
          phoneVerified: false,
          phoneVerificationStatus: hasPhone ? 'not-enabled' : 'not-provided',
          emailVerified: Boolean(isEmailVerified || auth?.currentUser?.emailVerified),
          emailVerificationStatus: isEmailVerified || auth?.currentUser?.emailVerified ? 'verified' : 'pending',
          occupationVerificationStatus: occupation ? 'pending' : 'not-required',
        }

        saveProfileLocallyAsPending({
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          location: payload.location,
          pincode: payload.pincode,
          gender: payload.gender,
          occupation: payload.occupation,
          preferredClaimMethod: payload.preferredClaimMethod,
          verification,
          documents,
        })

        setActiveEditSection(null)
        setFormStatus('Profile saved. You can continue editing or viewing other sections.')
      } else if (code === 'storage/object-not-found' || code === 'storage/bucket-not-found') {
        setFormError('Unable to save your documents. Please try again.')
      } else {
        setFormError(error?.message || 'Unable to save profile. Please check your connection and try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const toggleAutoClaimSetting = (key) => {
    setAutoClaimSettings((prev) => {
      const next = {
        ...prev,
        [key]: !prev[key],
      }

      localStorage.setItem('lokguard_auto_claim_settings', JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="page-shell">
      <section className="page-header">
        <span className="eyebrow">Account overview</span>
        <h1>Your profile</h1>
        <p>View user details, verification state, and active coverage in one place.</p>
        {formStatus && <p className="auth-status">{formStatus}</p>}
        {formError && <p className="auth-status auth-status-error">{formError}</p>}
      </section>

      <div className="page-grid three-up">
        <Card title="Identity" icon="👤" badge="Verified">
          <div className="profile-actions">
            {activeEditSection === 'identity' ? (
              <>
                <button
                  type="button"
                  className="profile-action-button"
                  onClick={() => handleSaveProfile('identity')}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save identity'}
                </button>
                <button
                  type="button"
                  className="profile-action-button profile-action-button--secondary"
                  onClick={cancelSectionEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="profile-action-button profile-action-button--secondary"
                onClick={() => startSectionEdit('identity')}
              >
                Edit identity
              </button>
            )}
          </div>
          {!isEmailVerified && (
            <div className="auth-status auth-status-error" style={{ marginBottom: '1rem' }}>
              Email not verified. Send OTP and verify it below.
            </div>
          )}
          {activeEditSection === 'identity' ? (
            <div className="profile-edit-grid">
              <label>
                Name
                <input
                  className="form-input"
                  value={editData.name}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  placeholder="Your full name"
                />
              </label>
              <label>
                Gender
                <select
                  className="form-input"
                  value={editData.gender}
                  onChange={(e) => handleEditChange('gender', e.target.value)}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </label>
              <label>
                Phone number
                <input
                  className="form-input"
                  value={editData.phone}
                  onChange={(e) => handleEditChange('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                />
                <small className="profile-file-note">Phone verification is removed. Use email verification below.</small>
              </label>
              <label>
                Email
                <input
                  className="form-input"
                  value={editData.email}
                  onChange={(e) => handleEditChange('email', e.target.value)}
                  placeholder="name@email.com"
                />
                <span className={`profile-verification-pill ${isEmailVerified ? 'verified' : 'pending'}`}>
                  {isEmailVerified ? 'Email verified' : 'Email not verified'}
                </span>
                {!isEmailVerified && (
                  <>
                    <div className="profile-actions" style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="profile-action-button profile-action-button--secondary"
                        onClick={handleEmailVerification}
                        disabled={isSendingEmailOtp}
                      >
                        {isSendingEmailOtp ? 'Sending OTP...' : 'Send OTP'}
                      </button>
                      <button
                        type="button"
                        className="profile-action-button profile-action-button--secondary"
                        onClick={checkVerificationStatus}
                        disabled={!isOtpReadyToVerify || isCheckingEmailOtp}
                      >
                        {isCheckingEmailOtp ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>
                    <input
                      className="form-input"
                      value={emailOtpCode}
                      onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      inputMode="numeric"
                      style={{ marginTop: '0.75rem' }}
                    />
                    <small className="profile-file-note">Didn't receive OTP? Check spam or ensure the OTP API server is running.</small>
                  </>
                )}
              </label>
            </div>
          ) : (
            <div className="profile-stack">
              <div><span>Name</span><strong>{profile.name || 'Not provided'}</strong></div>
              <div><span>Gender</span><strong>{profile.gender || 'Not provided'}</strong></div>
              <div><span>Phone</span><strong>{profile.phone || 'Not provided'}</strong></div>
              <div><span>Email</span><strong>{profile.email || 'Not provided'}</strong></div>
              {!isEmailVerified && <div><span>Verification</span><strong>Email not verified</strong></div>}
            </div>
          )}
        </Card>

        <Card title="Current work zone" icon="📍" badge="Active">
          <div className="profile-actions">
            {activeEditSection === 'work' ? (
              <>
                <button
                  type="button"
                  className="profile-action-button"
                  onClick={() => handleSaveProfile('work')}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save work zone'}
                </button>
                <button
                  type="button"
                  className="profile-action-button profile-action-button--secondary"
                  onClick={cancelSectionEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="profile-action-button profile-action-button--secondary"
                onClick={() => startSectionEdit('work')}
              >
                Edit work zone
              </button>
            )}
          </div>
          {activeEditSection === 'work' ? (
            <div className="profile-edit-grid">
              <label>
                City / location
                <input
                  className="form-input"
                  value={editData.location}
                  onChange={(e) => handleEditChange('location', e.target.value)}
                  placeholder="Mumbai, India"
                />
              </label>
              <label>
                Pincode
                <input
                  className="form-input"
                  value={editData.pincode}
                  onChange={(e) => handleEditChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="400001"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <label>
                Occupation
                <input
                  className="form-input"
                  value={editData.occupation}
                  onChange={(e) => handleEditChange('occupation', e.target.value)}
                  placeholder="Delivery partner"
                />
                {editData.occupation.trim() && (
                  <small className="profile-file-note">
                    ID proof and Aadhaar are required when occupation is provided.
                  </small>
                )}
              </label>
              {editData.occupation.trim() && (
                <label>
                  Upload ID proof
                  <input
                    className="form-input"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setIdProofFile(e.target.files?.[0] || null)}
                  />
                  {(idProofFile || idProofUrl) && (
                    <small className="profile-file-note">
                      {idProofFile ? `Selected: ${idProofFile.name}` : 'ID proof uploaded'}
                    </small>
                  )}
                </label>
              )}
              {editData.occupation.trim() && (
                <label>
                  Upload Aadhaar
                  <input
                    className="form-input"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)}
                  />
                  {(aadhaarFile || aadhaarUrl) && (
                    <small className="profile-file-note">
                      {aadhaarFile ? `Selected: ${aadhaarFile.name}` : 'Aadhaar uploaded'}
                    </small>
                  )}
                </label>
              )}
            </div>
          ) : (
            <div className="profile-stack">
              <div><span>City</span><strong>{profile.location}</strong></div>
              <div><span>Pincode</span><strong>{profile.pincode || 'Not provided'}</strong></div>
              <div><span>Risk level</span><strong>High disruption risk</strong></div>
              <div><span>Status</span><strong>{isEmailVerified ? 'Email verified' : 'Email verification pending'}</strong></div>
            </div>
          )}
        </Card>

        <Card title="Account summary" icon="🛡️" badge={planSummary.planName}>
          <div className="profile-actions">
            {activeEditSection === 'summary' ? (
              <>
                <button
                  type="button"
                  className="profile-action-button"
                  onClick={() => handleSaveProfile('summary')}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save summary'}
                </button>
                <button
                  type="button"
                  className="profile-action-button profile-action-button--secondary"
                  onClick={cancelSectionEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="profile-action-button profile-action-button--secondary"
                onClick={() => startSectionEdit('summary')}
              >
                Edit summary
              </button>
            )}
          </div>
          {activeEditSection === 'summary' ? (
            <div className="profile-edit-grid">
              <label>
                Preferred claim method
                <select
                  className="form-input"
                  value={editData.preferredClaimMethod}
                  onChange={(e) => handleEditChange('preferredClaimMethod', e.target.value)}
                >
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Wallet">Wallet</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="profile-stack">
              <div><span>Member since</span><strong>{memberSince}</strong></div>
              <div><span>Coverage</span><strong>{planSummary.coverageAmount}</strong></div>
              <div><span>Weekly premium</span><strong>{planSummary.price}</strong></div>
              <div><span>Claim method</span><strong>{profile.preferredClaimMethod || 'UPI'}</strong></div>
            </div>
          )}
        </Card>
      </div>

      <section className="card auto-claim-settings-card">
        <span className="eyebrow">Auto claim settings</span>
        <div className="auto-claim-list">
          <article className="auto-claim-item">
            <div>
              <h4>Auto Claim</h4>
              <p>Trigger eligible claims automatically when a disruption is detected.</p>
            </div>
            <button
              type="button"
              className={`toggle-switch ${autoClaimSettings.autoClaim ? 'active' : ''}`}
              onClick={() => toggleAutoClaimSetting('autoClaim')}
              aria-label="Toggle auto claim"
            >
              <span className="toggle-knob" />
            </button>
          </article>

          <article className="auto-claim-item">
            <div>
              <h4>Smart Detection</h4>
              <p>Continuously analyze weather and zone-based risk signals.</p>
            </div>
            <button
              type="button"
              className={`toggle-switch ${autoClaimSettings.smartDetection ? 'active' : ''}`}
              onClick={() => toggleAutoClaimSetting('smartDetection')}
              aria-label="Toggle smart detection"
            >
              <span className="toggle-knob" />
            </button>
          </article>

          <article className="auto-claim-item">
            <div>
              <h4>Manual Review</h4>
              <p>Require approval before final payout processing.</p>
            </div>
            <button
              type="button"
              className={`toggle-switch ${autoClaimSettings.manualReview ? 'active' : ''}`}
              onClick={() => toggleAutoClaimSetting('manualReview')}
              aria-label="Toggle manual review"
            >
              <span className="toggle-knob" />
            </button>
          </article>
        </div>
      </section>

    </div>
  )
}
