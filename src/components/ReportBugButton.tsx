import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { submitBugReport } from '../lib/bugReport'
import { appVersion } from '../lib/changelog'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'
import { useDesktopAutoFocus } from '../hooks/useDesktopAutoFocus'

/** Small persistent trigger in the top bar (every page, not tied to any one
 * section) -- opens a dropdown-style panel instead of a true modal, same as
 * everything else in this app (see useEscapeAndFocusReturn). */
export default function ReportBugButton() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Report a bug"
        title="Report a bug"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base-400 transition-colors duration-200 hover:bg-hover hover:text-base-100"
      >
        <BugGlyph />
      </button>
      {open && <ReportBugPanel onClose={() => setOpen(false)} />}
    </div>
  )
}

function BugGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
      <rect x="6" y="9" width="12" height="10" rx="5" />
      <path d="M6 13H3M21 13h-3M9 5 7.5 3.5M15 5l1.5-1.5M6 17l-2 2M18 17l2 2" />
    </svg>
  )
}

type Status = 'idle' | 'saving' | 'success' | 'error'

function ReportBugPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const location = useLocation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ url: string; number: number } | null>(null)
  // Desktop-only autofocus -- see the hook. On mobile, autofocusing here
  // would pop the keyboard the instant the bug icon is tapped, before the
  // panel has even settled into place.
  const titleInputRef = useDesktopAutoFocus(true)

  useEscapeAndFocusReturn(true, onClose)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // The submit button is disabled while saving, but a native form still
    // submits on Enter from the title field regardless of that -- without
    // this guard, pressing Enter again during a slow request re-fires
    // handleSubmit and files a second, duplicate issue.
    if (status === 'saving') return
    if (!title.trim() || !description.trim()) return
    setStatus('saving')
    setError(null)
    try {
      const res = await submitBugReport({
        title: title.trim(),
        description: description.trim(),
        username: user?.username,
        page: location.pathname,
        appVersion,
        userAgent: navigator.userAgent,
      })
      setResult(res)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit your report. Try again.')
      setStatus('error')
    }
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-hairline-strong bg-base-900 p-3.5 shadow-xl shadow-black/20">
      {status === 'success' && result ? (
        <div>
          <p className="text-sm text-base-200">Thanks — filed as issue #{result.number}.</p>
          <div className="mt-3 flex items-center gap-3">
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent-400 hover:underline"
            >
              View on GitHub &rarr;
            </a>
            <button type="button" onClick={onClose} className="text-xs text-base-500 hover:text-base-300">
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-base-500">Report a bug</p>
            <button type="button" onClick={onClose} className="text-xs text-base-500 hover:text-base-300">
              Cancel
            </button>
          </div>
          <input
            ref={titleInputRef}
            type="text"
            aria-label="Bug title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What went wrong, in a few words"
            maxLength={200}
            className="rounded-lg border border-hairline-strong bg-base-950 px-2.5 py-1.5 text-xs text-base-200 placeholder:text-base-600"
          />
          <textarea
            aria-label="Bug description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened, and what did you expect instead?"
            rows={4}
            maxLength={4000}
            className="resize-none rounded-lg border border-hairline-strong bg-base-950 px-2.5 py-1.5 text-xs text-base-200 placeholder:text-base-600"
          />
          <p className="text-[11px] text-base-600">
            Sent with the page you&apos;re on, your username, and the app version — no screenshot needed.
          </p>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            type="submit"
            disabled={status === 'saving' || !title.trim() || !description.trim()}
            className="self-start rounded-lg bg-accent-500/15 px-3 py-1.5 text-xs font-medium text-accent-300 ring-1 ring-accent-500/40 transition-opacity duration-150 disabled:opacity-50"
          >
            {status === 'saving' ? 'Sending…' : 'Send report'}
          </button>
        </form>
      )}
    </div>
  )
}
