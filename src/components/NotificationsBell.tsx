import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'
import {
  fetchNewFollowerCount,
  fetchRecentFollowerNotifications,
  markFollowNotificationsSeen,
} from '../lib/follows'
import type { RecentFollowerNotification } from '../lib/follows'
import { formatShortDate } from '../lib/date'

/** Bell icon in the top bar -- unread dot for new followers, opens an inline
 * dropdown of recent "X followed you" events. Placed last in the header
 * (after ReportBugButton) for the same reason ReportBugButton is last: its
 * panel is `absolute right-0` off its own trigger, so the trigger needs to
 * be the header's actual rightmost element for that math to land inside the
 * viewport on narrow screens -- see Navbar.tsx and ReportBugButton.tsx. */
export default function NotificationsBell() {
  const { user: me } = useAuth()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!me) return
    const userId = me.id
    let cancelled = false

    function refresh() {
      fetchNewFollowerCount(userId)
        .then((count) => {
          if (!cancelled) setUnread(count)
        })
        .catch(() => {
          // Silent -- a failed unread-count fetch shouldn't disrupt the rest
          // of the app. Worst case, the dot just doesn't show up.
        })
    }

    refresh()
    // Navbar (and this bell) mounts once for the whole session rather than
    // per-route, so without polling a new follower picked up mid-session
    // would never show up until a hard reload. A minute is frequent enough
    // to feel "live" without hammering Supabase on a low-stakes badge count.
    const interval = window.setInterval(refresh, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [me])

  if (!me) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} new` : 'Notifications'}
        title="Notifications"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base-400 transition-colors duration-200 hover:bg-hover hover:text-base-100"
      >
        <BellGlyph />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-400 ring-2 ring-base-950" />
        )}
      </button>
      {open && <NotificationsPanel userId={me.id} onSeen={() => setUnread(0)} onClose={() => setOpen(false)} />}
    </div>
  )
}

function BellGlyph() {
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
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  )
}

function NotificationsPanel({
  userId,
  onSeen,
  onClose,
}: {
  userId: string
  onSeen: () => void
  onClose: () => void
}) {
  const [notifications, setNotifications] = useState<RecentFollowerNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEscapeAndFocusReturn(true, onClose)

  useEffect(() => {
    let cancelled = false
    fetchRecentFollowerNotifications(userId)
      .then((rows) => {
        if (!cancelled) setNotifications(rows)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load notifications.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    // Fire-and-forget: if this fails, the unread dot just reappears next
    // time fetchNewFollowerCount runs -- a harmless, self-healing fallback,
    // not worth surfacing an error for.
    markFollowNotificationsSeen(userId)
      .then(onSeen)
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-hairline-strong bg-base-900 p-3.5 shadow-xl shadow-black/20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-500">Notifications</p>
        <button type="button" onClick={onClose} className="text-xs text-base-500 hover:text-base-300">
          Close
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-base-850/70" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <p className="py-3 text-center text-xs text-base-500">No new followers yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {notifications.map((n) => (
            <li key={n.followId}>
              <Link
                to={`/u/${n.followerUsername}`}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors duration-200 hover:bg-hover"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-[11px] font-semibold text-accent-300 ring-1 ring-accent-500/20">
                  {n.followerUsername.slice(0, 2).toUpperCase()}
                </div>
                <p className="min-w-0 flex-1 truncate text-xs text-base-200">
                  <span className="font-medium text-base-100">@{n.followerUsername}</span> started following you
                </p>
                <span className="shrink-0 text-[10px] text-base-500">{formatShortDate(n.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
