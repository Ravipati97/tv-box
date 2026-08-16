import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { checkPasscode, markGatePassed } from '../lib/siteGate'
import AppLogo from './AppLogo'

export default function PasscodeGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    if (checkPasscode(code)) {
      markGatePassed()
      onSuccess()
    } else {
      setError('That code isn’t right.')
    }
    setBusy(false)
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
          <p className="mt-1 text-sm text-base-400">This one&apos;s invite-only.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-hairline bg-base-850/70 p-6 shadow-xl shadow-black/10 dark:shadow-black/20"
        >
          <div>
            <label htmlFor="passcode" className="mb-1.5 block text-sm font-medium text-base-200">
              Enter passcode
            </label>
            <input
              id="passcode"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''))
                setError(null)
              }}
              placeholder="••••••"
              className="w-full rounded-lg border border-hairline-strong bg-base-900 px-3.5 py-3 text-center text-lg font-semibold tracking-[0.5em] text-base-100 placeholder:tracking-normal placeholder:text-base-500 focus:border-accent-500/60"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length === 0}
            className="w-full rounded-lg bg-accent-500 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent-500/30 transition-all duration-200 hover:bg-accent-600 hover:shadow-accent-500/40 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            Continue
          </button>
        </form>
      </motion.div>
    </div>
  )
}
