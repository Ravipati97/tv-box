import { useState } from 'react'
import type { ReactNode } from 'react'
import { UNKNOWN_WATCHED_AT } from '../lib/watched'
import { todayLocalDateInput } from '../lib/date'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'

/**
 * A small text trigger that expands into a date picker + confirm, so any
 * "mark watched" action -- bulk (whole show/season), starting a show fresh,
 * or a single episode -- can land on the right date in History instead of
 * defaulting to today. Shared so all contexts stay visually and
 * behaviorally identical.
 *
 * No native confirm() dialog -- the inline Confirm button click, after
 * explicitly opening this control and picking a date, is already the
 * confirmation step. A second native popup on top of that is just friction,
 * even for the bulk actions.
 */
export default function DateMarkControl({
  label,
  onConfirm,
  className,
  confirmSummary,
}: {
  label: string
  onConfirm: (input: { watchedAt: string; unknownDate: boolean }) => Promise<void>
  className?: string
  /** Shown above the date picker once expanded -- e.g. "This will overwrite
   * the date on 3 already-watched episodes." A bulk action's real
   * consequences should be visible before the Confirm tap, not just after. */
  confirmSummary?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayLocalDateInput)
  const [unknownDate, setUnknownDate] = useState(false)
  const [saving, setSaving] = useState(false)
  const today = todayLocalDateInput()

  useEscapeAndFocusReturn(open, () => setOpen(false))

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs text-accent-400 hover:underline ${className ?? ''}`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {confirmSummary && <p className="max-w-xs text-[11px] text-warning">{confirmSummary}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={date}
          max={today}
          disabled={unknownDate}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-hairline-strong bg-base-900 px-2 py-1 text-xs text-base-200 disabled:opacity-40"
        />
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onConfirm({
                watchedAt: unknownDate ? UNKNOWN_WATCHED_AT : new Date(`${date}T12:00:00`).toISOString(),
                unknownDate,
              })
              setOpen(false)
            } finally {
              setSaving(false)
            }
          }}
          className="rounded-lg bg-accent-500/15 px-2.5 py-1 text-xs font-medium text-accent-300 ring-1 ring-accent-500/40 transition-opacity duration-150 disabled:opacity-60"
        >
          {saving ? 'Marking…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-base-500 hover:text-base-300"
        >
          Cancel
        </button>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-base-500">
        <input
          type="checkbox"
          checked={unknownDate}
          onChange={(e) => setUnknownDate(e.target.checked)}
          className="h-3 w-3 rounded border-hairline-strong bg-base-900 accent-accent-500"
        />
        Don&apos;t remember exactly when — just log it as watched a while ago
      </label>
    </div>
  )
}
