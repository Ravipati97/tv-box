import { useState } from 'react'
import { todayLocalDateInput } from '../lib/date'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'

/**
 * Expand-to-confirm control for logging a rewatch -- same shape as
 * DateMarkControl (no native confirm(): opening this and then tapping
 * Confirm *is* the confirmation) so a stray double-tap on the collapsed
 * trigger can't silently insert a second rewatch. That was the actual bug
 * behind "it keeps adding it" -- logRewatch is an intentional plain insert
 * (rewatching the same show twice is the whole point of the log), so
 * nothing ever stopped a second, accidental tap from counting too.
 *
 * Doesn't reuse DateMarkControl directly: that control's "date unknown"
 * checkbox is specific to backfilling watched-episode history and doesn't
 * apply to logging a single rewatch event happening (approximately) now.
 */
export default function RewatchLogControl({
  count,
  onConfirm,
}: {
  count: number
  onConfirm: (rewatchedAt: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayLocalDateInput)
  const [saving, setSaving] = useState(false)
  const today = todayLocalDateInput()

  useEscapeAndFocusReturn(open, () => setOpen(false))

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-accent-400 hover:underline"
      >
        {count > 0 ? `Log another rewatch (${count} so far)` : 'Log a rewatch'}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-lg border border-hairline-strong bg-base-900 px-2 py-1 text-xs text-base-200"
      />
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true)
          try {
            await onConfirm(new Date(`${date}T12:00:00`).toISOString())
          } finally {
            setSaving(false)
            setOpen(false)
          }
        }}
        className="rounded-lg bg-accent-500/15 px-2.5 py-1 text-xs font-medium text-accent-300 ring-1 ring-accent-500/40 transition-opacity duration-150 disabled:opacity-60"
      >
        {saving ? 'Logging…' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-base-500 hover:text-base-300"
      >
        Cancel
      </button>
    </div>
  )
}
