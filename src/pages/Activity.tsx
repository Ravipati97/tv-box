import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { fetchRecentShowRatingsAllUsers } from '../lib/showRatings'
import { fetchRecentWatchedAllUsers } from '../lib/watched'
import { buildGroupActivity } from '../lib/showActivity'
import type { GroupActivityEvent } from '../lib/showActivity'
import { fetchAllUsers } from '../lib/users'
import { dayKey, formatDiaryHeading } from '../lib/date'
import ActivityRow from '../components/ActivityRow'
import { useAuth } from '../contexts/AuthContext'
import type { AppUser } from '../types'

interface DayGroup {
  heading: string
  items: GroupActivityEvent[]
}

export default function Activity() {
  const { user: me } = useAuth()
  const [events, setEvents] = useState<GroupActivityEvent[]>([])
  const [members, setMembers] = useState<AppUser[]>([])
  const [filterUsername, setFilterUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchRecentShowRatingsAllUsers(500), fetchRecentWatchedAllUsers(1500), fetchAllUsers()])
      .then(([ratingRows, watchedRows, users]) => {
        if (!cancelled) {
          setEvents(buildGroupActivity(ratingRows, watchedRows))
          setMembers(users)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activity.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Only show member chips for people who've actually got something in the
  // feed -- filtering to someone with nothing to show would be a dead end.
  const activeUsernames = useMemo(() => new Set(events.map((e) => e.username)), [events])
  const filterableMembers = useMemo(
    () => members.filter((u) => activeUsernames.has(u.username)),
    [members, activeUsernames],
  )

  const filtered = useMemo(
    () => (filterUsername ? events.filter((e) => e.username === filterUsername) : events),
    [events, filterUsername],
  )

  const dayGroups = useMemo<DayGroup[]>(() => {
    const groups: DayGroup[] = []
    let currentKey = ''
    for (const e of filtered) {
      const key = dayKey(e.at)
      if (key !== currentKey) {
        groups.push({ heading: formatDiaryHeading(e.at), items: [e] })
        currentKey = key
      } else {
        groups[groups.length - 1].items.push(e)
      }
    }
    return groups
  }, [filtered])

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="font-display text-xl font-semibold text-base-100 sm:text-2xl">Activity</h1>
        <p className="mt-1 text-sm text-base-500">What the group has been finishing and rating.</p>
      </motion.div>

      {filterableMembers.length > 1 && (
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={filterUsername === null} onClick={() => setFilterUsername(null)}>
            Everyone
          </FilterChip>
          {filterableMembers.map((u) => (
            <FilterChip
              key={u.id}
              active={filterUsername === u.username}
              onClick={() => setFilterUsername(u.username)}
            >
              {me?.username === u.username ? 'You' : `@${u.username}`}
            </FilterChip>
          ))}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-base-850/70" />
          ))}
        </div>
      ) : dayGroups.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-hairline bg-base-850/40 px-6 py-14 text-center">
          <div className="mb-3 text-4xl">👋</div>
          <p className="max-w-xs text-sm text-base-500">
            {filterUsername
              ? `@${filterUsername} hasn't rated or finished anything yet.`
              : "Nobody's rated or finished a show yet. Be the first."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dayGroups.map((group) => (
            <div key={group.heading + group.items[0].key}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-500">
                {group.heading}
              </h3>
              <div className="space-y-2">
                {group.items.map((event, i) => (
                  <motion.div
                    key={event.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}
                  >
                    <ActivityRow event={event} />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
        active
          ? 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40'
          : 'bg-base-850/60 text-base-400 ring-1 ring-hairline hover:text-base-200'
      }`}
    >
      {children}
    </button>
  )
}
