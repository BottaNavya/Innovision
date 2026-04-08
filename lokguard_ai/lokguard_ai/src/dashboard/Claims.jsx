import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import '../App.css'

export default function Claims() {
  const navigate = useNavigate()
  const [showClaimModal, setShowClaimModal] = useState(false)
  const [isEmailVerifiedForClaims, setIsEmailVerifiedForClaims] = useState(false)
  const [newClaim, setNewClaim] = useState({
    title: '',
    amount: '',
    description: '',
    proof: null,
  })

  const [claims, setClaims] = useState([
    {
      id: 'CLM001',
      title: 'Rain disruption claim',
      date: '2026-04-03',
      amount: '₹500',
      status: 'approved',
      proof: '📸',
      description: 'Heavy rain caused order cancellation and reduced shifts.',
    },
    {
      id: 'CLM002',
      title: 'Traffic delay claim',
      date: '2026-04-04',
      amount: '₹320',
      status: 'pending',
      proof: '📸',
      description: 'Route congestion reduced completed deliveries.',
    },
    {
      id: 'CLM003',
      title: 'Pollution disruption claim',
      date: '2026-04-02',
      amount: '₹280',
      status: 'rejected',
      proof: '📸',
      description: 'Insufficient location match for disruption data.',
    },
  ])

  useEffect(() => {
    const syncVerificationState = () => {
      try {
        const localUser = JSON.parse(localStorage.getItem('user') || '{}')
        setIsEmailVerifiedForClaims(Boolean(localUser?.verification?.emailVerified))
      } catch {
        setIsEmailVerifiedForClaims(false)
      }
    }

    syncVerificationState()
    window.addEventListener('lokguard-auth-changed', syncVerificationState)
    return () => window.removeEventListener('lokguard-auth-changed', syncVerificationState)
  }, [])

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setNewClaim({ ...newClaim, proof: file.name })
    }
  }

  const handleRaiseClaim = (e) => {
    e.preventDefault()

    if (!isEmailVerifiedForClaims) {
      alert('Verify your email in Profile before raising a claim.')
      setShowClaimModal(false)
      navigate('/profile')
      return
    }

    if (!newClaim.title || !newClaim.amount || !newClaim.description) {
      alert('Please fill all fields')
      return
    }

    const claim = {
      id: `CLM${String(claims.length + 1).padStart(3, '0')}`,
      title: newClaim.title,
      date: new Date().toISOString().split('T')[0],
      amount: `₹${newClaim.amount}`,
      status: 'pending',
      proof: '📸',
      description: newClaim.description,
    }

    setClaims([claim, ...claims])
    setNewClaim({ title: '', amount: '', description: '', proof: null })
    setShowClaimModal(false)
  }

  return (
    <div className="page-shell claims-page">
      <section className="page-header">
        <span className="eyebrow">Claims</span>
        <h1>Claim management</h1>
        <p>
          Raise claims, upload proof, and track status in a clean card-based view.
          Color-coded badges show Pending, Approved, and Rejected at a glance.
        </p>
      </section>

      <div className="page-grid">
        <Card title="Claims overview" icon="🧾" badge={`${claims.length} total`}>
          {!isEmailVerifiedForClaims && (
            <p className="auth-status auth-status-error" style={{ marginBottom: '0.75rem' }}>
              Verify your email in Profile to unlock claim submission.
            </p>
          )}

          <button
            className="raise-claim-button"
            onClick={() => {
              if (!isEmailVerifiedForClaims) {
                navigate('/profile')
                return
              }

              setShowClaimModal(true)
            }}
          >
            + Raise Claim
          </button>

          <div className="claim-content">
            {claims.map((claim) => (
              <article key={claim.id} className={`claim-item ${claim.status}-claim`}>
                <div className="claim-header">
                  <div className="claim-proof">{claim.proof}</div>
                  <div className="claim-details">
                    <p className="claim-title">{claim.title}</p>
                    <p className="claim-date">{claim.date}</p>
                    <p className="claim-description">{claim.description}</p>
                  </div>
                  <div className="claim-amount">{claim.amount}</div>
                </div>

                <div className="claim-footer">
                  <div className={`claim-status ${claim.status}`}>{claim.status.toUpperCase()}</div>
                  <span className="claim-id">ID: {claim.id}</span>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </div>

      {showClaimModal && (
        <div className="modal-overlay" onClick={() => setShowClaimModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🧾 Raise a claim</h2>
              <button className="modal-close" onClick={() => setShowClaimModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleRaiseClaim} className="claim-form">
              <div className="form-group">
                <label htmlFor="claim-title">Claim title *</label>
                <input
                  id="claim-title"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Heavy Rain Disruption"
                  value={newClaim.title}
                  onChange={(e) => setNewClaim({ ...newClaim, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="claim-amount">Estimated loss (₹) *</label>
                <input
                  id="claim-amount"
                  type="number"
                  className="form-input"
                  placeholder="Enter amount"
                  value={newClaim.amount}
                  onChange={(e) => setNewClaim({ ...newClaim, amount: e.target.value })}
                  required
                  min="100"
                  max="10000"
                />
              </div>

              <div className="form-group">
                <label htmlFor="claim-description">Description *</label>
                <textarea
                  id="claim-description"
                  className="form-textarea"
                  placeholder="Describe the disruption and income impact"
                  value={newClaim.description}
                  onChange={(e) => setNewClaim({ ...newClaim, description: e.target.value })}
                  rows="4"
                  required
                ></textarea>
              </div>

              <div className="form-group">
                <label htmlFor="claim-proof">Upload proof (image placeholder)</label>
                <div className="file-upload-container">
                  <input
                    id="claim-proof"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="file-input"
                  />
                  <label htmlFor="claim-proof" className="file-upload-label">
                    <span className="upload-icon">📸</span>
                    <span className="upload-text">
                      {newClaim.proof ? newClaim.proof : 'Click to upload proof image'}
                    </span>
                    <span className="upload-hint">PNG, JPG, GIF up to 5MB</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowClaimModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Submit claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
