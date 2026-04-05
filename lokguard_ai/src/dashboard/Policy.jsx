import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import '../App.css'

function getRiskCategory(location) {
  const locationLower = location.toLowerCase()
  const highRiskCities = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'pune', 'kolkata', 'chennai', 'ahmedabad', 'jaipur', 'gurgaon', 'noida']
  const mediumRiskCities = ['lucknow', 'kanpur', 'indore', 'vadodara', 'ghaziabad', 'ludhiana', 'bhopal', 'nagpur', 'aurangabad']

  if (highRiskCities.some((city) => locationLower.includes(city))) {
    return { level: 'high', premium: 25, label: 'High risk' }
  }

  if (mediumRiskCities.some((city) => locationLower.includes(city))) {
    return { level: 'medium', premium: 20, label: 'Medium risk' }
  }

  return { level: 'low', premium: 15, label: 'Low risk' }
}

export default function Policy() {
  const [location, setLocation] = useState('Mumbai, India')
  const [selectedPlanId, setSelectedPlanId] = useState(() => localStorage.getItem('selectedPlanId') || 'standard')
  const [activePlanId, setActivePlanId] = useState(() => localStorage.getItem('activePlanId') || 'standard')

  const getStoredUid = () => {
    try {
      const session = JSON.parse(localStorage.getItem('userSession') || '{}')
      return session.uid || ''
    } catch {
      return ''
    }
  }

  const getCurrentUid = () => auth?.currentUser?.uid || getStoredUid()

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setLocation(parsed?.location || 'Mumbai, India')
      } catch {
        setLocation('Mumbai, India')
      }
    }
  }, [])

  useEffect(() => {
    const hydratePlanFromFirebase = async () => {
      if (!db) return

      const uid = getCurrentUid()
      if (!uid) return

      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (!snap.exists()) return

        const data = snap.data() || {}
        const activePlan = data.activePlan || null
        if (activePlan?.planId) {
          setActivePlanId(activePlan.planId)
          setSelectedPlanId(activePlan.planId)
          localStorage.setItem('activePlanId', activePlan.planId)
          localStorage.setItem('selectedPlanId', activePlan.planId)
          localStorage.setItem('policyPlan', JSON.stringify(activePlan))
        }
      } catch {
        // localStorage fallback is already available
      }
    }

    hydratePlanFromFirebase()
  }, [])

  const risk = getRiskCategory(location)

  const plans = useMemo(
    () => [
      {
        id: 'basic',
        name: 'Basic',
        price: '₹15/week',
        coverage: ['Weather only'],
      },
      {
        id: 'standard',
        name: 'Standard',
        price: '₹20/week',
        coverage: ['Rain', 'Traffic', 'Pollution'],
        badge: 'Most Popular',
      },
      {
        id: 'premium',
        name: 'Premium',
        price: '₹25/week',
        coverage: ['Full coverage'],
      },
      {
        id: 'ai-smart',
        name: 'AI Smart',
        price: `₹${risk.premium}/week`,
        coverage: ['Personalized protection'],
        subtitle: 'Dynamic pricing',
        badge: 'AI Recommended',
      },
    ],
    [risk.premium]
  )

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[1]
  const activePlan = plans.find((plan) => plan.id === activePlanId) || plans[1]

  const handleSelectPlan = (planId) => {
    setSelectedPlanId(planId)
    localStorage.setItem('selectedPlanId', planId)
  }

  const handleActivatePlan = () => {
    const planPayload = {
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      price: selectedPlan.price,
      coverage: selectedPlan.id === 'basic' ? 'Weather only' : selectedPlan.id === 'standard' ? 'Rain + Traffic + Pollution' : selectedPlan.id === 'premium' ? 'Full coverage' : 'Personalized protection',
      coverageAmount: selectedPlan.id === 'basic' ? '₹25,000' : selectedPlan.id === 'standard' ? '₹50,000' : selectedPlan.id === 'premium' ? '₹75,000' : `₹${risk.premium * 3000}`,
      location,
      activatedAt: new Date().toISOString(),
    }

    setActivePlanId(selectedPlan.id)
    localStorage.setItem('activePlanId', selectedPlan.id)
    localStorage.setItem('policyPlan', JSON.stringify(planPayload))

    const uid = getCurrentUid()
    if (db && uid) {
      setDoc(
        doc(db, 'users', uid),
        {
          location,
          activePlan: planPayload,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {
        // ignore write failures and keep local state
      })
    }
  }

  return (
    <div className="page-shell policy-page">
      <section className="page-header">
        <span className="eyebrow">Policy management</span>
        <h1>Choose your LokGuard plan</h1>
        <p>
          Select a plan, compare coverage, and activate instantly. Your selected
          plan is saved and used for policy pricing.
        </p>
      </section>

      <div className="policy-plans-grid">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id
          const isActive = activePlanId === plan.id

          return (
            <article
              key={plan.id}
              className={`plan-card ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className="plan-card-header">
                <h3>{plan.name}</h3>
                {plan.badge && (
                  <span className={`plan-badge ${plan.id === 'ai-smart' ? 'ai' : 'popular'}`}>
                    {plan.badge}
                  </span>
                )}
              </div>

              {plan.subtitle && <p className="plan-subtitle">{plan.subtitle}</p>}
              <p className="plan-price">{plan.price}</p>

              <ul className="plan-features">
                {plan.coverage.map((feature) => (
                  <li key={feature}>✔ {feature}</li>
                ))}
              </ul>

              <button
                type="button"
                className={`plan-select-button ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectPlan(plan.id)}
              >
                {isSelected ? 'Selected' : 'Select Plan'}
              </button>
            </article>
          )
        })}
      </div>

      <div className="page-grid three-up">
        <div className="card">
          <div className="card-header">
            <h3>📅 Weekly plan</h3>
            <span className="status-badge active">Current</span>
          </div>
          <div className="policy-stack policy-stack--compact">
            <div><span>Selected plan</span><strong>{selectedPlan.name}</strong></div>
            <div><span>Premium</span><strong>{selectedPlan.price}</strong></div>
            <div><span>Coverage</span><strong>{selectedPlan.id === 'basic' ? 'Weather only' : selectedPlan.id === 'standard' ? 'Rain + Traffic + Pollution' : selectedPlan.id === 'premium' ? 'Full coverage' : 'Personalized protection'}</strong></div>
            <div><span>Work zone</span><strong>{location}</strong></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>💰 Premium details</h3>
            <span className="status-badge pending">{risk.label}</span>
          </div>
          <div className="policy-stack policy-stack--compact">
            <div><span>Plan premium</span><strong>{selectedPlan.price}</strong></div>
            <div><span>Location risk</span><strong>{risk.label}</strong></div>
            <div><span>Coverage amount</span><strong>{selectedPlan.id === 'basic' ? '₹25,000' : selectedPlan.id === 'standard' ? '₹50,000' : selectedPlan.id === 'premium' ? '₹75,000' : `₹${risk.premium * 3000}`}</strong></div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>🛡️ Policy status</h3>
            <span className="status-badge active">Active</span>
          </div>
          <div className="policy-stack policy-stack--compact">
            <div><span>Active plan</span><strong>{activePlan.name}</strong></div>
            <div><span>Expiry</span><strong>Dec 31, 2024</strong></div>
            <div><span>Renewal</span><strong>Auto renewal enabled</strong></div>
          </div>
        </div>
      </div>

      <div className="policy-footer card">
        <div>
          <span className="eyebrow">Coverage action</span>
          <h3>{selectedPlan.id === activePlan.id ? 'Selected plan is active' : 'Activate selected plan'}</h3>
          <p>
            Activate <strong>{selectedPlan.name}</strong> to apply this coverage for your weekly protection.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={handleActivatePlan}>
          {selectedPlan.id === activePlan.id ? 'Plan Active' : 'Activate Selected Plan'}
        </button>
      </div>
    </div>
  )
}
