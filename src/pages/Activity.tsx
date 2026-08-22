import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchRecentShowRatingsAllUsers } from '../lib/showRatings'
import { fetchRecentSeasonRatingsAllUsers } from '../lib/seasonRatings'
import { fetchRecentWatchedAllUsers } from '../lib/watched'
import { buildFollowActivity, buildGroupActivity, mergeActivityFeed } from '../lib/showActivity'
import type { ActivityFeedItem } from '../lib/showActivity'
import { fetchAllUsers } from '../lib/users'
import { fetchAllFollows, fetchFollowingIds } from '../lib/follows'
import { dayKey, formatDiaryHeading } from '../lib/date'
import ActivityRow from '../components/ActivityRow'
import FollowActivityRow from '../components/FollowActivityRow'
import EmptyState from '../components/EmptyState'
import { useAuth } from '../contexts/AuthContext'
import type { AppUser } from '../types'

interface DayGroup {
  heading: string
  items: ActivityFeedItem[]
}

type Scope = 'following' | 'everyone'

/** Who "did" this item, for scope-filtering and the person-chip row -- a
 * show event's actor is whoever rated/finished it, a follow event's actor
 * is whoever did the following (not who got followed). */
function actorUsername(item: ActivityFeedItem): string {
  return item.kind === 'follow' ? item.followerUsername : item.username
}
function actorId(item: ActivityFeedItem, usernameToId: Map<string, string>): string | undefined {
  return item.kind === 'follow' ? item.followerId : usernameToId.get(item.username)
}

export default function Activity() {
  const { user: me } = useAuth()
  const [feed, setFeed] = useState<ActivityFeedItem[]>([])
  const [members, setMembers] = useState<AppUser[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [scope, setScope] = useState<Scope>('following')
  const [filterUsername, setFilterUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRecentShowRatingsAllUsers(500),
      fetchRecentWatchedAllUsers(1500),
      fetchRecentSeasonRatingsAllUsers(500),
      fetchAllUsers(),
      fetchAllFollows(),
      me ? fetchFollowingIds(me.id) : Promise.resolve(new Set<string>()),
    ])
      .then(([ratingRows, watchedRows, seasonRatingRows, users, follows, following]) => {
        if (!cancelled) {
          const showEvents = buildGroupActivity(ratingRows, watchedRows, seasonRatingRows)
          const usernameById = new Map(users.map((u) => [u.id, u.username]))
          const followEvents = buildFollowActivity(follows, usernameById)
          setFeed(mergeActivityFeed(showEvents, followEvents))
          setMembers(users)
          setFollowingIds(following)
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
  }, [me])

  const usernameToId = useMemo(() => new Map(members.map((u) => [u.username, u.id])), [members])

  // "Following" scope keeps an item if whoever did it is someone you follow,
  // or you (your own activity always shows up in your own feed) -- "Everyone"
  // skips this filter entirely. Applied before the person-chip filter below,
  // so the chip row only ever offers people actually visible in this scope.
  const scoped = useMemo(() => {
    if (scope === 'everyone' || !me) return feed
    return feed.filter((item) => {
      const id = actorId(item, usernameToId)
      return id === me.id || followingIds.has(id ?? '')
    })
  }, [feed, scope, me, followingIds, usernameToId])

  const activeUsernames = useMemo(() => new Set(scoped.map(actorUsername)), [scoped])
  const filterableMembers = useMemo(
    () => members.filter((u) => activeUsernames.has(u.username)),
    [members, activeUsernames],
  )

  const filtered = useMemo(
    () => (filterUsername ? scoped.filter((item) => actorUsername(item) === filterUsername) : scoped),
    [scoped, filterUsername],
  )

  const dayGroups = useMemo<DayGroup[]>(() => {
    const groups: DayGroup[] = []
    let currentKey = ''
    for (const item of filtered) {
      // Unknown-date events carry a placeholder timestamp (epoch) purely so
      // the column can stay NOT NULL -- never format it as a real date.
      // They already sort last (epoch loses every date comparison), so they
      // naturally collapse into one trailing group here.
      const key = item.atUnknown ? 'unknown' : dayKey(item.at)
      if (key !== currentKey) {
        groups.push({
          heading: item.atUnknown ? 'Watched a while ago' : formatDiaryHeading(item.at),
          items: [item],
        })
        currentKey = key
      } else {
        groups[groups.length - 1].items.push(item)
      }
    }
    return groups
  }, [filtered])

  const emptyMessage = filterUsername
    ? `@${filterUsername} hasn't done anything yet.`
    : scope === 'following'
      ? followingIds.size === 0
        ? "You're not following anyone yet."
        : 'Nobody you follow has done anything yet.'
      : "Nobody's rated or finished a show yet. Be the first."

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="font-display text-xl font-semibold text-base-100 sm:text-2xl">Activity</h1>
        <p className="mt-1 text-sm text-base-500">
          {scope === 'following' ? "What people you follow have been up to." : 'What the group has been up to.'}
        </p>
      </motion.div>

      <div className="mb-3 flex gap-1.5">
        <ScopeChip active={scope === 'following'} onClick={() => setScope('following')}>
          Following
        </ScopeChip>
        <ScopeChip active={scope === 'everyone'} onClick={() => setScope('everyone')}>
          Everyone
        </ScopeChip>
      </div>

      {filterableMembers.length > 1 && (
        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={filterUsername === null} onClick={() => setFilterUsername(null)}>
            All
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
        <EmptyState icon="👋">
          <p className="max-w-xs text-sm text-base-500">{emptyMessage}</p>
          {!filterUsername && scope === 'following' && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setScope('everyone')}
                className="text-xs text-accent-400 hover:underline"
              >
                See everyone's activity
              </button>
              {followingIds.size === 0 && (
                <Link to="/members" className="text-xs text-accent-400 hover:underline">
                  Find people to follow
                </Link>
              )}
            </div>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {dayGroups.map((group) => (
            <div key={group.heading + group.items[0].key}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-500">
                {group.heading}
              </h3>
              <div className="space-y-2">
                {group.items.map((item, i) => (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}
                  >
                    {item.kind === 'follow' ? <FollowActivityRow event={item} /> : <ActivityRow event={item} />}
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

function ScopeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
        active
          ? 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40'
          : 'bg-base-850/60 text-base-400 ring-1 ring-hairline hover:text-base-200'
      }`}
    >
      {children}
    </button>
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
