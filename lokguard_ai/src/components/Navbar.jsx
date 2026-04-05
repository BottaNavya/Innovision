import { Link, NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useTheme } from '../hooks/useTheme'

const links = [
  { to: '/home', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/claims', label: 'Claims' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/policy', label: 'Policy' },
  { to: '/profile', label: 'Profile' },
]

export default function Navbar({ isAuthenticated }) {
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth)
      } catch {
        // Even if Firebase signOut fails, clear local session to prevent stale auth UI.
      }
    }

    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('userSession')
    localStorage.removeItem('user')
    window.dispatchEvent(new Event('lokguard-auth-changed'))
    navigate('/auth')
  }

  return (
    <nav className="app-navbar">
      <Link to="/home" className="nav-brand">
        <span className="nav-brand-mark">🛡️</span>
        <span>
          <strong>LokGuard AI</strong>
          <small>Income protection for gig workers</small>
        </span>
      </Link>

      <div className="nav-links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </div>

      <button
        type="button"
        className="nav-theme-toggle"
        onClick={toggleTheme}
        title="Toggle dark mode"
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      {isAuthenticated ? (
        <button type="button" className="nav-action nav-action-button" onClick={handleLogout}>
          Logout
        </button>
      ) : (
        <Link to="/auth" className="nav-action">
          Login / Register
        </Link>
      )}
    </nav>
  )
}
