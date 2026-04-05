import { useEffect, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import '../App.css'

const mockAlerts = [
  {
    id: 'ALR-001',
    title: 'Heavy Rain Detected in Madhapur',
    detail: '67mm rainfall recorded',
    status: 'claimed',
    payout: '₹300 credited',
    live: true,
  },
  {
    id: 'ALR-002',
    title: 'Traffic Congestion in Hitech City',
    detail: 'Average delay increased by 42 minutes',
    status: 'monitoring',
    payout: 'Pending review',
    live: false,
  },
  {
    id: 'ALR-003',
    title: 'Air Quality Spike in Gachibowli',
    detail: 'AQI crossed 230 for over 2 hours',
    status: 'eligible',
    payout: 'Auto-claim eligibility confirmed',
    live: false,
  },
]

export default function Alerts() {
  const [alerts, setAlerts] = useState(mockAlerts)
  const [statusText, setStatusText] = useState('Showing latest alert stream.')
  const [isAddingAlert, setIsAddingAlert] = useState(false)

  const getCurrentUid = () => {
    try {
      const session = JSON.parse(localStorage.getItem('userSession') || '{}')
      return auth?.currentUser?.uid || session.uid || ''
    } catch {
      return auth?.currentUser?.uid || ''
    }
  }

  useEffect(() => {
    const uid = getCurrentUid()
    if (!db || !uid) {
      setStatusText('Using local mock alerts (no Firebase session).')
      return
    }

    const loadAlerts = async () => {
      try {
        const userRef = doc(db, 'users', uid)
        const snap = await getDoc(userRef)
        const data = snap.exists() ? snap.data() : {}
        const cloudAlerts = Array.isArray(data?.alerts) ? data.alerts : []

        if (cloudAlerts.length > 0) {
          setAlerts(cloudAlerts)
          setStatusText('Live alerts synced from Firebase.')
          return
        }

        // Seed default mock alerts for first-time users.
        await setDoc(
          userRef,
          {
            alerts: mockAlerts,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        )

        setAlerts(mockAlerts)
        setStatusText('Default alerts were added to Firebase for your account.')
      } catch {
        setAlerts(mockAlerts)
        setStatusText('Unable to fetch Firebase alerts. Showing mock data.')
      }
    }

    loadAlerts()
  }, [])

  const handleAddMockAlert = async () => {
    const templates = [
      {
        title: 'Heavy Rain Warning in Kondapur',
        detail: '58mm rainfall detected in the last hour.',
        status: 'claimed',
        payout: '₹260 credited',
      },
      {
        title: 'Traffic Standstill in Jubilee Hills',
        detail: 'Average delivery delay exceeded 37 minutes.',
        status: 'monitoring',
        payout: 'Pending verification',
      },
      {
        title: 'Air Quality Alert in Banjara Hills',
        detail: 'AQI crossed 210 during active shift hours.',
        status: 'eligible',
        payout: 'Eligible for auto-claim review',
      },
    ]

    const sample = templates[Math.floor(Math.random() * templates.length)]
    const newAlert = {
      id: `ALR-${Date.now()}`,
      title: sample.title,
      detail: sample.detail,
      status: sample.status,
      payout: sample.payout,
      live: true,
    }

    const nextAlerts = [newAlert, ...alerts].slice(0, 10)
    setAlerts(nextAlerts)
    setStatusText('New mock alert added locally.')

    const uid = getCurrentUid()
    if (!db || !uid) return

    setIsAddingAlert(true)
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          alerts: nextAlerts,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      setStatusText('New mock alert saved to Firebase.')
    } catch {
      setStatusText('Added locally, but Firebase save failed.')
    } finally {
      setIsAddingAlert(false)
    }
  }

  return (
    <div className="page-shell alerts-page">
      <section className="alerts-header">
        <h1>Live Alerts</h1>
        <p>Real-time disruption monitoring</p>
        <small className="alerts-source-note">{statusText}</small>
        <button
          type="button"
          className="alerts-add-button"
          onClick={handleAddMockAlert}
          disabled={isAddingAlert}
        >
          {isAddingAlert ? 'Adding...' : 'Add Mock Alert'}
        </button>
      </section>

      <article className="alerts-monitor card">
        <span className="alerts-dot" />
        <div>
          <h3>Monitoring Active</h3>
          <p>AI is tracking environmental conditions in real-time.</p>
        </div>
      </article>

      <section className="alerts-feed">
        {alerts.map((alert) => (
          <article key={alert.id} className={`alerts-item card ${alert.status}`}>
            <div className="alerts-item-head">
              <div>
                <h3>{alert.title}</h3>
                <p>{alert.detail}</p>
              </div>
              <span className={`alerts-pill ${alert.live ? 'live' : ''}`}>
                {alert.live ? 'Live now' : 'Recent'}
              </span>
            </div>

            <div className="alerts-item-meta">
              <span className={`alerts-tag ${alert.status}`}>{alert.status}</span>
              <strong>{alert.payout}</strong>
            </div>

            <small>{alert.id}</small>
          </article>
        ))}
      </section>
    </div>
  )
}
