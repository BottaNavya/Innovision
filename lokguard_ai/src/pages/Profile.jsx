import { useEffect, useRef, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { sendEmailVerification } from 'firebase/auth'
import Card from '../components/Card'
import { auth, db, storage } from '../firebase'
import '../App.css'

export default function Profile() {
  const PROFILE_DRAFT_KEY = 'lokguard_profile_draft'
  const PROFILE_PENDING_SYNC_KEY = 'lokguard_profile_pending_sync'

  const [profile, setProfile] = useState({
    name: 'LokGuard User',
    phone: '',
    email: '',
    location: 'Mumbai, India',
    occupation: '',
    preferredClaimMethod: '',
  })
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    email: '',
    location: '',
    occupation: '',
    preferredClaimMethod: 'UPI',
  })
  const [activeEditSection, setActiveEditSection] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
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
        name: localUser.name || 'LokGuard User',
        phone: localUser.phone || '',
        email: localUser.email || '',
        location: localUser.location || 'Mumbai, India',
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
          name: data.name || localUser.name || 'LokGuard User',
          phone: data.phone || localUser.phone || '',
          email: data.email || localUser.email || '',
          location: data.location || localUser.location || 'Mumbai, India',
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
        setFormStatus('Using offline/local profile data. Firebase data will refresh when connection is back.')
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
      setIsEmailVerified(Boolean(auth?.currentUser?.emailVerified))
    }

    setFormError('')
    setFormStatus('')
  }

  const updateEmailVerificationState = () => {
    const verified = Boolean(auth?.currentUser?.emailVerified)
    setIsEmailVerified(verified)

    try {
      const localUser = JSON.parse(localStorage.getItem('user') || '{}')
      localStorage.setItem(
        'user',
        JSON.stringify({
          ...localUser,
          email: auth?.currentUser?.email || localUser.email || '',
          verification: {
            ...(localUser.verification || {}),
            emailVerified: verified,
            emailVerificationStatus: verified ? 'verified' : 'pending',
          },
        })
      )
    } catch {
      // Ignore local cache failures.
    }

    return verified
  }

  const checkVerificationStatus = async () => {
    setFormError('')
    setFormStatus('')

    if (!auth?.currentUser) {
      setFormError('No signed-in user was found. Please log in again.')
      return
    }

    try {
      await auth.currentUser.reload()
      const verified = updateEmailVerificationState()
      setFormStatus(verified ? 'Email is now verified.' : 'Email is still not verified. Check your inbox and spam folder.')
    } catch (error) {
      setFormError(error?.message || 'Could not refresh verification status.')
    }
  }

  const handleEmailVerification = async () => {
    setFormError('')
    setFormStatus('')

    if (!auth?.currentUser) {
      setFormError('No signed-in user was found. Please log in again.')
      return
    }

    if (auth.currentUser.emailVerified) {
      updateEmailVerificationState()
      setFormStatus('Email is already verified.')
      return
    }

    setIsVerifyingEmail(true)

    try {
      await sendEmailVerification(auth.currentUser)
      setFormStatus('Verification email sent. Open the link in your inbox, then refresh the status.')
    } catch (error) {
      if (error?.code === 'auth/requires-recent-login') {
        setFormError('Please sign in again before sending a verification email.')
      } else {
        setFormError(error?.message || 'Failed to send verification email.')
      }
    } finally {
      setIsVerifyingEmail(false)
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
    const occupation = editData.occupation.trim()
    const preferredClaimMethod = editData.preferredClaimMethod.trim()

    const shouldSaveIdentity = section === 'all' || section === 'identity'
    const shouldSaveWork = section === 'all' || section === 'work'
    const shouldSaveSummary = section === 'all' || section === 'summary'

    if (shouldSaveIdentity && (!name || !email)) {
      setFormError('Name and email are required for Identity.')
      return
    }

    if (shouldSaveWork && !location) {
      setFormError('Location is required for Work zone.')
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

    const canSkipPhoneVerification = true

    const uid = auth?.currentUser?.uid || getStoredUid()
    if (!uid || !db) {
      setFormError('Firebase session not found. Please login again to save profile.')
      return
    }

    const payload = {
      name: shouldSaveIdentity ? name : profile.name,
      email: shouldSaveIdentity ? email : profile.email,
      phone: shouldSaveIdentity ? normalizedPhone : profile.phone,
      location: shouldSaveWork ? location : profile.location,
      occupation: shouldSaveWork ? (occupation || 'Gig worker') : profile.occupation,
      preferredClaimMethod: shouldSaveSummary || shouldSaveWork
        ? (preferredClaimMethod || 'UPI')
        : profile.preferredClaimMethod,
      verification: {
        phoneVerified: false,
        phoneVerificationStatus: (shouldSaveIdentity ? normalizedPhone : profile.phone) ? 'not-verified' : 'not-provided',
        phoneVerificationNote: canSkipPhoneVerification ? 'phone-verification-disabled' : '',
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
        occupation: payload.occupation,
        preferredClaimMethod: payload.preferredClaimMethod,
      }

      // Optimistic update: show new values immediately while Firebase sync continues.
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
      setFormStatus('Saved locally. Syncing to Firebase...')

      // Yield once so React can paint the normal view immediately.
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
          occupation: payload.occupation,
          preferredClaimMethod: payload.preferredClaimMethod,
          verification: {
            phoneVerified: false,
            phoneVerificationStatus: normalizedPhone ? 'not-verified' : 'not-provided',
            phoneVerificationNote: 'phone-verification-disabled',
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

      setFormStatus(`${sectionLabel} updated and synced to Firebase.`)
      window.dispatchEvent(new Event('lokguard-auth-changed'))
    } catch (error) {
      const code = error?.code || ''

      if (code === 'permission-denied' || code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
        setFormError('Firebase permissions blocked this save. Deploy firestore.rules and storage.rules, then try again.')
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
          phoneVerificationStatus: normalizedPhone ? 'not-verified' : 'not-provided',
          phoneVerificationNote: 'phone-verification-disabled',
          emailVerified: Boolean(isEmailVerified || auth?.currentUser?.emailVerified),
          emailVerificationStatus: isEmailVerified || auth?.currentUser?.emailVerified ? 'verified' : 'pending',
          occupationVerificationStatus: occupation ? 'pending' : 'not-required',
        }

        saveProfileLocallyAsPending({
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          location: payload.location,
          occupation: payload.occupation,
          preferredClaimMethod: payload.preferredClaimMethod,
          verification,
          documents,
        })

        setActiveEditSection(null)
        setFormStatus('You appear offline. Profile was saved locally and marked for later Firebase sync.')
      } else if (code === 'storage/object-not-found' || code === 'storage/bucket-not-found') {
        setFormError('Firebase Storage is not ready. Enable Storage in Firebase Console and retry.')
      } else {
        setFormError(error?.message || 'Failed to save profile to Firebase. Please try again.')
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
              Email not verified. Send a verification link and refresh the status after confirming it.
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
                Phone number
                <input
                  className="form-input"
                  value={editData.phone}
                  onChange={(e) => handleEditChange('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                />
                <small className="profile-file-note">Phone verification is currently disabled.</small>
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
                <div className="profile-actions" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="profile-action-button profile-action-button--secondary"
                    onClick={handleEmailVerification}
                    disabled={isVerifyingEmail}
                  >
                    {isVerifyingEmail ? 'Sending...' : 'Send verification email'}
                  </button>
                  <button
                    type="button"
                    className="profile-action-button profile-action-button--secondary"
                    onClick={checkVerificationStatus}
                  >
                    Refresh status
                  </button>
                </div>
              </label>
            </div>
          ) : (
            <div className="profile-stack">
              <div><span>Name</span><strong>{profile.name || 'Not provided'}</strong></div>
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
