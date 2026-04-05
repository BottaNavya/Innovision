export default function Card({ title, eyebrow, badge, icon, children, className = '', footer }) {
  return (
    <section className={`card product-card ${className}`.trim()}>
      {(eyebrow || title || badge || icon) && (
        <header className="card-header">
          <div className="card-heading-group">
            {icon && <span className="card-icon">{icon}</span>}
            <div>
              {eyebrow && <p className="card-eyebrow">{eyebrow}</p>}
              {title && <h3>{title}</h3>}
            </div>
          </div>
          {badge && <span className="status-badge verified">{badge}</span>}
        </header>
      )}

      <div className="card-content">{children}</div>

      {footer && <footer className="card-footer">{footer}</footer>}
    </section>
  )
}
