import { useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

type Step = 'email' | 'username'

export default function Login() {
  const { user, findByEmail, register, signIn } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/search" replace />

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
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" className="mb-4">
            <rect width="32" height="32" rx="8" fill="var(--color-accent-500)" />
            <rect x="6" y="9" width="20" height="14" rx="3" fill="var(--color-base-950)" />
            <path d="M15 14.5L19 16.5L15 18.5V14.5Z" fill="var(--color-star)" />
          </svg>
          <h1 className="font-display text-2xl font-semibold text-base-100">TV Box</h1>
          <p className="mt-1 text-sm text-base-400">Track every show. Rate every episode.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Supabase isn&apos;t configured yet. Set VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY (see README) for sign-in to work.
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/5 bg-base-850/70 p-6 shadow-xl shadow-black/20">
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
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full rounded-lg border border-white/10 bg-base-900 px-3.5 py-2.5 text-base text-base-100 placeholder:text-base-500 focus:border-accent-500/60 sm:text-sm"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-600 disabled:opacity-50"
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
                    type="text"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="mt-3 w-full rounded-lg border border-white/10 bg-base-900 px-3.5 py-2.5 text-base text-base-100 placeholder:text-base-500 focus:border-accent-500/60 sm:text-sm"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-600 disabled:opacity-50"
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
