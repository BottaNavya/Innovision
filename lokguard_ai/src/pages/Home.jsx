import { Link } from 'react-router-dom'
import Card from '../components/Card'
import GigIllustration from '../components/GigIllustration'
import '../App.css'

const highlights = [
  { icon: '🌧️', title: 'Rain impact', text: 'Monsoon alerts can interrupt delivery routes and reduce income.' },
  { icon: '🚗', title: 'Traffic delays', text: 'Congested roads create long dead zones with no completed orders.' },
  { icon: '💨', title: 'Pollution spikes', text: 'Poor air quality reduces rider productivity and safety.' },
]

export default function Home() {
  return (
    <div className="page-shell home-page landing-page">
      <section className="hero-grid landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">For gig workers</span>
          <h1>TinyBheema: micro-insurance for every shift.</h1>
          <p>
            LokGuard&apos;s TinyBheema provides affordable, on-demand micro-insurance tailored for gig workers,
            ensuring financial protection anytime, anywhere.
          </p>
          <div className="hero-actions">
            <Link to="/auth" className="primary-button">Get Started</Link>
            <Link to="/dashboard" className="secondary-button">Open Dashboard</Link>
          </div>
          <div className="hero-metrics hero-metrics--landing">
            <div><strong>₹15-25</strong><span>weekly premium</span></div>
            <div><strong>AI + Human</strong><span>claim review</span></div>
            <div><strong>Real-time</strong><span>disruption signals</span></div>
          </div>
        </div>

        <div className="hero-visual card landing-visual">
          <div className="hero-panel-header">
            <span className="status-badge active">Protected live</span>
            <span className="status-badge pending">Weather + traffic scan</span>
          </div>

          <GigIllustration variant="hero" />
        </div>
      </section>

      <section className="section-stack landing-stack">
        <Card title="The problem we solve" eyebrow="What gig workers face" icon="🧠">
          <div className="problem-grid">
            <article className="problem-block">
              <strong>Unpredictable weather</strong>
              <p>Rain and flooding can wipe out a day’s earnings in minutes.</p>
            </article>
            <article className="problem-block">
              <strong>Route delays</strong>
              <p>Traffic jams create dead time when workers are still paying expenses.</p>
            </article>
            <article className="problem-block">
              <strong>Hidden risk</strong>
              <p>Most protection products are not designed around city-level disruption.</p>
            </article>
          </div>
        </Card>

        <Card title="Product highlights" eyebrow="What makes it different" icon="✨">
          <div className="feature-grid">
            {highlights.map((item) => (
              <article key={item.title} className="feature-tile">
                <span className="feature-icon">{item.icon}</span>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </Card>

        <div className="cta-strip card">
          <div>
            <h3>Why TinyBheema by LokGuard?</h3>
            <p>
              We don&apos;t just track disruptions — we protect your income from them.
            </p>
            <p>
              Smart AI detects risks, and ensures you are compensated when conditions stop your work.
            </p>
            <p>
              Because every day you work matters.
            </p>
          </div>
          <Link to="/dashboard" className="primary-button">View Product</Link>
        </div>
      </section>
    </div>
  )
}
