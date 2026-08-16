import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import AppLogo from '../components/AppLogo'

type Step = 'email' | 'username'

/**
 * Focuses the input on mount, but only on devices with a precise pointer
 * (i.e. desktop with a mouse). Auto-focusing on touch devices pops the
 * on-screen keyboard immediately on page load, which on mobile browsers can
 * cause the layout to shift/zoom unexpectedly before the user has done
 * anything -- so we skip it there and let people tap in themselves.
 */
function useDesktopAutoFocus(active: boolean) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (window.matchMedia('(pointer: fine)').matches) {
      ref.current?.focus()
    }
  }, [active])
  return ref
}

export default function Login() {
  const { user, findByEmail, register, signIn } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const emailInputRef = useDesktopAutoFocus(step === 'email')
  const usernameInputRef = useDesktopAutoFocus(step === 'username')

  if (user) return <Navigate to="/home" replace />

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const existing = await findByEmail(email)
      if (existing) {
        signIn(existing)
      } else {
        setStep('username')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = username.trim()
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      setError('Username must be 3-20 characters: letters, numbers, underscores.')
      return
    }
    setBusy(true)
    try {
      await register(email, trimmed)
      // Successful registration updates the auth state; the Navigate above will fire.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <AppLogo size={48} className="mb-4 drop-shadow-[0_6px_20px_rgba(139,92,246,0.35)]" />
          <h1 className="font-display text-2xl font-semibold text-base-100">TV Box</h1>
          <p className="mt-1 text-sm text-base-400">Track every show. Rate every episode.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Supabase isn&apos;t configured yet. Set VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY (see README) for sign-in to work.
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-hairline bg-base-850/70 p-6 shadow-xl shadow-black/10 dark:shadow-black/20">
          <AnimatePresence mode="wait">
            {step === 'email' ? (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleEmailSubmit}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-base-200">
                    Email address
                  </label>
                  <input
                    id="email"
                    ref={emailInputRef}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full rounded-lg border border-hairline-strong bg-base-900 px-3.5 py-2.5 text-base text-base-100 placeholder:text-base-500 focus:border-accent-500/60 sm:text-sm"
                  />
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-accent-500 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent-500/30 transition-all duration-200 hover:bg-accent-600 hover:shadow-accent-500/40 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  {busy ? 'Checking…' : 'Continue'}
                </button>
                <p className="text-center text-xs text-base-500">
                  New here? We&apos;ll ask you to pick a username next. Returning? You&apos;re
                  straight in — no password needed.
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="username"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleUsernameSubmit}
                className="space-y-4"
              >
                <div>
                  <p className="text-sm text-base-300">
                    First time seeing <span className="font-medium text-base-100">{email}</span>.
                    Pick a username to finish creating your account.
                  </p>
                  <input
                    id="username"
                    ref={usernameInputRef}
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="mt-3 w-full rounded-lg border border-hairline-strong bg-base-900 px-3.5 py-2.5 text-base text-base-100 placeholder:text-base-500 focus:border-accent-500/60 sm:text-sm"
                  />
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-accent-500 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent-500/30 transition-all duration-200 hover:bg-accent-600 hover:shadow-accent-500/40 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                >
                  {busy ? 'Creating account…' : 'Create account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setUsername('')
                    setError(null)
                  }}
                  className="w-full text-center text-xs text-base-500 hover:text-base-300"
                >
                  &larr; Use a different email
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
