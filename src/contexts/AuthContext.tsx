import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { AppUser } from '../types'

const STORAGE_KEY = 'tvbox_user'

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
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setUser(JSON.parse(stored) as AppUser)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
        setUser(newUser)
        return newUser
      },
      signIn(nextUser: AppUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
        setUser(nextUser)
      },
      signOut() {
        localStorage.removeItem(STORAGE_KEY)
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
