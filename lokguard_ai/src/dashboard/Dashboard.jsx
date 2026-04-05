import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/Card'
import '../App.css'

const disruptionAlerts = [
  { icon: '🌧️', label: 'Rain', severity: 'high', impact: 'Delivery delay risk' },
  { icon: '🚗', label: 'Traffic', severity: 'medium', impact: 'Route slowdown detected' },
  { icon: '💨', label: 'Pollution', severity: 'medium', impact: 'Work hours reduced' },
]

const weeklyMetrics = [
  { label: 'Protected earnings', value: '₹2,450' },
  { label: 'Claims filed', value: '5' },
  { label: 'Safety score', value: '92%' },
]

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

function getCoverageAmount(planId, riskPremium) {
  if (planId === 'basic') return '₹25,000'
  if (planId === 'standard') return '₹50,000'
  if (planId === 'premium') return '₹75,000'
  return `₹${riskPremium * 3000}`
}

function getCoverageLabel(planId) {
  if (planId === 'basic') return 'Weather only'
  if (planId === 'standard') return 'Rain + Traffic + Pollution'
  if (planId === 'premium') return 'Full coverage'
  return 'Personalized protection'
}

export default function Dashboard() {
  const [userData, setUserData] = useState({
    name: 'Guest User',
    phone: 'N/A',
    location: 'Mumbai, India',
  })
  const [policyPlan, setPolicyPlan] = useState({
    planId: 'standard',
    planName: 'Standard',
    price: '₹20/week',
    location: 'Mumbai, India',
  })

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    let planLocation = 'Mumbai, India'

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        planLocation = parsed?.location || 'Mumbai, India'
        setUserData({
          name: parsed?.name || 'Guest User',
          phone: parsed?.phone || 'N/A',
          location: planLocation,
        })
      } catch {
        planLocation = 'Mumbai, India'
        setUserData({
          name: 'Guest User',
          phone: 'N/A',
          location: 'Mumbai, India',
        })
      }
    }

    const storedPolicy = localStorage.getItem('policyPlan')
    if (storedPolicy) {
      try {
        const parsed = JSON.parse(storedPolicy)
        setPolicyPlan({
          planId: parsed?.planId || 'standard',
          planName: parsed?.planName || 'Standard',
          price: parsed?.price || '₹20/week',
          location: parsed?.location || 'Mumbai, India',
          coverage: parsed?.coverage || getCoverageLabel(parsed?.planId || 'standard'),
          coverageAmount: parsed?.coverageAmount || '₹50,000',
        })
      } catch {
        setPolicyPlan({
          planId: 'standard',
          planName: 'Standard',
          price: '₹20/week',
          location: 'Mumbai, India',
        })
      }
    } else {
      const activePlanId = localStorage.getItem('activePlanId') || 'standard'
      const activePlanName = activePlanId === 'basic' ? 'Basic' : activePlanId === 'premium' ? 'Premium' : activePlanId === 'ai-smart' ? 'AI Smart' : 'Standard'
      const planRisk = getRiskCategory(planLocation)
      setPolicyPlan({
        planId: activePlanId,
        planName: activePlanName,
        price: activePlanId === 'basic' ? '₹15/week' : activePlanId === 'premium' ? '₹25/week' : activePlanId === 'ai-smart' ? `₹${planRisk.premium}/week` : '₹20/week',
        location: planLocation,
        coverage: getCoverageLabel(activePlanId),
        coverageAmount: getCoverageAmount(activePlanId, planRisk.premium),
      })
    }
  }, [])

  const userLocation = userData.location
  const risk = getRiskCategory(userLocation)
  const policyStatus = 'Active'
  const activePlanName = policyPlan.planName
  const activePlanPrice = policyPlan.price || `₹${risk.premium}/week`
  const activePlanCoverage = policyPlan.coverage || getCoverageLabel(policyPlan.planId)
  const activeCoverageAmount = policyPlan.coverageAmount || getCoverageAmount(policyPlan.planId, risk.premium)

  return (
    <div className="page-shell dashboard-page">
      <section className="page-header dashboard-header-block">
        <span className="eyebrow">Dashboard</span>
        <h1>Income protection overview</h1>
        <p>
          Clean fintech-style overview for gig workers with policy status,
          dynamic premium, live disruption signals, and fast claim actions.
        </p>
      </section>

      <div className="dashboard-grid">
        <Card title="User profile summary" icon="👤" badge="Verified" className="dashboard-card dashboard-card--summary">
          <div className="summary-stack">
            <div className="summary-row">
              <span className="summary-label">Name</span>
              <strong>{userData.name}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-label">Phone</span>
              <strong>{userData.phone}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-label">Location</span>
              <strong>{userData.location}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-label">Member since</span>
              <strong>Jan 2024</strong>
            </div>
          </div>
        </Card>

        <Card title="Policy status" icon="📋" badge={policyStatus} className="dashboard-card dashboard-card--policy">
          <div className="status-panel">
            <div className="status-line">
              <span className="summary-label">Active plan</span>
              <strong>{activePlanName}</strong>
            </div>
            <div className="status-line">
              <span className="summary-label">Coverage</span>
              <strong>{activePlanCoverage}</strong>
            </div>
            <div className="status-line">
              <span className="summary-label">Renewal</span>
              <strong>Dec 31, 2024</strong>
            </div>
            <div className="progress-shell">
              <div className="progress-fill" style={{ width: '76%' }}></div>
            </div>
            <div className="status-footer">
              <span className="status-badge active">Covered</span>
              <span className="status-subtext">Plan utilization 76%</span>
            </div>
          </div>
        </Card>

        <Card title="Dynamic premium" icon="💰" badge={`${risk.label}`} className="dashboard-card dashboard-card--premium">
          <div className="premium-panel">
            <div className="premium-value">{activePlanPrice}</div>
            <p className="premium-note">Active plan for {userLocation}</p>
            <div className="premium-breakdown">
              <div><span>Coverage amount</span><strong>{activeCoverageAmount}</strong></div>
              <div><span>Location risk</span><strong>{risk.label}</strong></div>
            </div>
          </div>
        </Card>

        <Card title="AI disruption alert" icon="⚡" badge="Live" className="dashboard-card dashboard-card--alerts">
          <div className="alert-stack">
            <div className="alert-banner">
              <span className="alert-banner-icon">🚨</span>
              <div>
                <strong>3 active signals</strong>
                <p>Conditions are affecting delivery routes in {userLocation}.</p>
              </div>
            </div>
            {disruptionAlerts.map((alert) => (
              <div key={alert.label} className={`disruption-pill ${alert.severity}`}>
                <span>{alert.icon}</span>
                <div>
                  <strong>{alert.label}</strong>
                  <p>{alert.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Quick actions" icon="⚙️" badge="Fast track" className="dashboard-card dashboard-card--actions">
          <div className="quick-actions">
            <Link to="/claims" className="action-card primary-action">
              <strong>Raise claim</strong>
              <span>Submit proof and request support</span>
            </Link>
            <Link to="/policy" className="action-card">
              <strong>Manage policy</strong>
              <span>Review plan, premium, and expiry</span>
            </Link>
            <Link to="/profile" className="action-card">
              <strong>View profile</strong>
              <span>Update user details and work zone</span>
            </Link>
          </div>
        </Card>

        <Card title="This week" icon="📊" badge="Stable" className="dashboard-card dashboard-card--metrics">
          <div className="metrics-grid">
            {weeklyMetrics.map((metric) => (
              <div key={metric.label} className="metric-card">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
