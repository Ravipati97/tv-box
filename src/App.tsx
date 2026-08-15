import { lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import PasscodeGate from './components/PasscodeGate'
import { hasPassedGate, isGateConfigured } from './lib/siteGate'
import Login from './pages/Login'

// Every other page is code-split from the login bundle -- most sessions
// only ever touch a couple of these, so there's no reason to ship all of
// them (plus TMDB/Supabase calls, plus framer-motion usage) in the first
// paint's JS.
const Home = lazy(() => import('./pages/Home'))
const Activity = lazy(() => import('./pages/Activity'))
const Search = lazy(() => import('./pages/Search'))
const ShowDetail = lazy(() => import('./pages/ShowDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const Members = lazy(() => import('./pages/Members'))
const PublicProfile = lazy(() => import('./pages/PublicProfile'))
const ShowDiary = lazy(() => import('./pages/ShowDiary'))
const Compare = lazy(() => import('./pages/Compare'))
const ListDetail = lazy(() => import('./pages/ListDetail'))
const Recap = lazy(() => import('./pages/Recap'))

function PageLoader() {
  return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-base-700 border-t-accent-400" />
    </div>
  )
}

/** Lazy pages need their own Suspense boundary that sits *inside* Routes,
 * so Routes itself (keyed on pathname) stays AnimatePresence's direct
 * child and route-change exit/enter animations keep working. */
function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

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
            path="/home"
            element={
              <ProtectedRoute>
                <Page>
                  <Home />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute>
                <Page>
                  <Activity />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <Page>
                  <Search />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/show/:id"
            element={
              <ProtectedRoute>
                <Page>
                  <ShowDetail />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Page>
                  <Profile />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <Page>
                  <Members />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/u/:username"
            element={
              <ProtectedRoute>
                <Page>
                  <PublicProfile />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/u/:username/shows/:showId"
            element={
              <ProtectedRoute>
                <Page>
                  <ShowDiary />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare/:username"
            element={
              <ProtectedRoute>
                <Page>
                  <Compare />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/u/:username/lists/:listId"
            element={
              <ProtectedRoute>
                <Page>
                  <ListDetail />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/recap"
            element={
              <ProtectedRoute>
                <Page>
                  <Recap />
                </Page>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={user ? '/home' : '/login'} replace />} />
          <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  )
}
