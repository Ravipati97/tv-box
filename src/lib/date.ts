/** Local calendar-day key (YYYY-MM-DD), independent of time-of-day, for grouping. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** "Today" / "Yesterday" / "Wednesday, June 3" (adds the year if not this year). */
export function formatDiaryHeading(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/** Compact "Aug 12" style date for inline use in list rows. Handles both
 * full ISO timestamps (watched_at, rated_at, etc. -- a real instant, safe
 * to hand straight to `new Date`) and TMDB's date-only "YYYY-MM-DD" strings
 * (air_date -- needs the same local-calendar-day parsing as isFutureDate
 * above, or it silently rolls back a day for anyone west of UTC: an episode
 * airing "2026-08-18" would print as "Aug 17"). */
export function formatShortDate(iso: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const date = dateOnly
    ? (() => {
        const [y, m, d] = iso.split('-').map(Number)
        return new Date(y, m - 1, d)
      })()
    : new Date(iso)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Today's date as a local YYYY-MM-DD string, for pre-filling/limiting a
 * `<input type="date">`. Deliberately NOT `new Date().toISOString().slice(0, 10)`
 * -- that reads the UTC date, which is a different calendar day from the
 * viewer's local "today" for roughly 2/3 of the day depending on timezone
 * (e.g. it's already "tomorrow" in UTC well before midnight for anyone west
 * of it). Using the UTC string here would both pre-fill the wrong default
 * date and let the `max` bound silently accept a not-actually-past date. */
export function todayLocalDateInput(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Whether a TMDB date-only string (YYYY-MM-DD, no time component) is still
 * ahead of today, judged by the viewer's *local calendar day* -- not by
 * comparing to a UTC-midnight instant. `new Date(dateStr) > new Date()`
 * looks right but isn't: `new Date("2026-08-20")` is 2026-08-20T00:00:00Z,
 * which is already in the past for most of the day (in local terms) for
 * anyone west of UTC, and episodes would flip from "upcoming" to "aired" up
 * to ~12 hours before they actually air locally. Comparing local calendar
 * dates instead makes the flip happen at the viewer's own local midnight.
 */
export function isFutureDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return false
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return target > startOfToday
}
