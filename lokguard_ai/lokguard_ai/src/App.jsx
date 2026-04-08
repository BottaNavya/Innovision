import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Profile from './pages/Profile'
import Dashboard from './dashboard/Dashboard'
import Claims from './dashboard/Claims'
import Policy from './dashboard/Policy'
import Alerts from './pages/Alerts'

const getHasLocalSession = () => localStorage.getItem('isLoggedIn') === 'true'

function ProtectedRoute({ isAuthenticated, isCheckingAuth, children }) {
  if (isCheckingAuth) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />
  }

  return children
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(getHasLocalSession())
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  useEffect(() => {
    const syncAuthState = async () => {
      const hasLocalSession = getHasLocalSession()
      const { data } = await supabase.auth.getSession()
      const hasSupabaseSession = Boolean(data?.session)
      setIsAuthenticated(hasSupabaseSession || hasLocalSession)
      setIsCheckingAuth(false)
    }

    const handleAuthStateChange = () => {
      syncAuthState()
    }

    window.addEventListener('storage', handleAuthStateChange)
    window.addEventListener('lokguard-auth-changed', handleAuthStateChange)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasLocalSession = getHasLocalSession()
      const hasSession = Boolean(session) || hasLocalSession

      if (session) {
        localStorage.setItem('isLoggedIn', 'true')
      }

      setIsAuthenticated(hasSession)
      setIsCheckingAuth(false)
    })

    syncAuthState()

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('storage', handleAuthStateChange)
      window.removeEventListener('lokguard-auth-changed', handleAuthStateChange)
    }
  }, [])

  return (
    <>
      <Navbar isAuthenticated={isAuthenticated} />
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isCheckingAuth={isCheckingAuth}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isCheckingAuth={isCheckingAuth}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/claims"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isCheckingAuth={isCheckingAuth}>
              <Claims />
            </ProtectedRoute>
          }
        />
        <Route
          path="/policy"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isCheckingAuth={isCheckingAuth}>
              <Policy />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alerts"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isCheckingAuth={isCheckingAuth}>
              <Alerts />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}
