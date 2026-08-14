import { useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import PasscodeGate from './components/PasscodeGate'
import { hasPassedGate, isGateConfigured } from './lib/siteGate'
import Login from './pages/Login'
import Search from './pages/Search'
import ShowDetail from './pages/ShowDetail'
import Profile from './pages/Profile'
import Members from './pages/Members'
import PublicProfile from './pages/PublicProfile'
import Compare from './pages/Compare'

function AppShell() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const showNav = Boolean(user) && location.pathname !== '/login'
  const [gatePassed, setGatePassed] = useState(hasPassedGate)

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-base-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-base-700 border-t-accent-400" />
      </div>
    )
  }

  // Unauthenticated visitors have to clear the shared passcode before they
  // can even see the login/registration screen, for any URL they land on.
  if (!user && isGateConfigured && !gatePassed) {
    return <PasscodeGate onSuccess={() => setGatePassed(true)} />
  }

  return (
    <div className="min-h-dvh bg-base-950">
      {showNav && <Navbar />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<Login />} />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            }
          />
          <Route
            path="/show/:id"
            element={
              <ProtectedRoute>
                <ShowDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <Members />
              </ProtectedRoute>
            }
          />
          <Route
            path="/u/:username"
            element={
              <ProtectedRoute>
                <PublicProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare/:username"
            element={
              <ProtectedRoute>
                <Compare />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={user ? '/search' : '/login'} replace />} />
          <Route path="*" element={<Navigate to={user ? '/search' : '/login'} replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </HashRouter>
  )
}
