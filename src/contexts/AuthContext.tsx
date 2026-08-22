import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { AppUser } from '../types'

const STORAGE_KEY = 'tvbox_user'

// localStorage access itself (not just JSON.parse-ing what's in it) can
// throw -- Safari private browsing on older iOS, storage-partitioning edge
// cases, and locked-down/kiosk browser configs all do this. Without these
// guards, a `localStorage.getItem` throwing here happens synchronously
// inside an effect during the very first render, before there's any user to
// show a friendly "logged out" state to -- worth catching explicitly rather
// than relying on ErrorBoundary to paper over the whole app failing to boot.
function readStoredUser(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function writeStoredUser(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Session still works in-memory for this tab; it just won't survive a reload.
  }
}
function clearStoredUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage isn't writable in the first place.
  }
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  /**
   * Looks up a user by email. Returns the user if found (caller should treat
   * this as "logged in"), or null if this email hasn't registered yet
   * (caller should then prompt for a username and call register()).
   */
  findByEmail: (email: string) => Promise<AppUser | null>
  /** Creates a new user with the given email + unique username and signs them in. */
  register: (email: string, username: string) => Promise<AppUser>
  /** Sets the given user as the active session (used after findByEmail succeeds). */
  signIn: (user: AppUser) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = readStoredUser()
    if (stored) {
      try {
        setUser(JSON.parse(stored) as AppUser)
      } catch {
        clearStoredUser()
      }
    }
    setLoading(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async findByEmail(email: string) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase().trim())
          .maybeSingle()
        if (error) throw error
        return (data as AppUser) ?? null
      },
      async register(email: string, username: string) {
        const { data, error } = await supabase
          .from('users')
          .insert({ email: email.toLowerCase().trim(), username: username.trim() })
          .select()
          .single()
        if (error) {
          if (error.code === '23505') {
            // unique_violation -- figure out which column collided for a clearer message
            throw new Error(
              error.message.includes('username')
                ? 'That username is taken. Try another.'
                : 'An account with that email already exists.',
            )
          }
          throw error
        }
        const newUser = data as AppUser
        writeStoredUser(JSON.stringify(newUser))
        setUser(newUser)
        return newUser
      },
      signIn(nextUser: AppUser) {
        writeStoredUser(JSON.stringify(nextUser))
        setUser(nextUser)
      },
      signOut() {
        clearStoredUser()
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
