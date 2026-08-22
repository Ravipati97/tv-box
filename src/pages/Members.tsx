import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchAllUsers } from '../lib/users'
import { fetchFollowerIds, fetchFollowingIds, followUser, unfollowUser } from '../lib/follows'
import FollowButton from '../components/FollowButton'
import type { AppUser } from '../types'

/** The old flat Members directory, now with a real follow graph: every row
 * gets a Follow/Following button and a "Follows you" badge instead of just
 * being a static list. Search stays exactly as it was -- discovery still
 * matters at this app's size, just with follow state layered on top. */
export default function Members() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchAllUsers(),
      me ? fetchFollowingIds(me.id) : Promise.resolve(new Set<string>()),
      me ? fetchFollowerIds(me.id) : Promise.resolve(new Set<string>()),
    ])
      .then(([allUsers, following, followers]) => {
        if (!cancelled) {
          setUsers(allUsers)
          setFollowingIds(following)
          setFollowerIds(followers)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load members.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [me])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.username.toLowerCase().includes(q))
  }, [users, query])

  async function handleFollow(targetId: string) {
    if (!me) return
    setSavingId(targetId)
    setFollowingIds((prev) => new Set(prev).add(targetId))
    try {
      await followUser(me.id, targetId)
    } catch {
      setFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
      setError('Failed to follow. Try again.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleUnfollow(targetId: string) {
    if (!me) return
    setSavingId(targetId)
    setFollowingIds((prev) => {
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })
    try {
      await unfollowUser(me.id, targetId)
    } catch {
      setFollowingIds((prev) => new Set(prev).add(targetId))
      setError('Failed to unfollow. Try again.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display mb-5 text-2xl font-semibold text-base-100"
      >
        People
      </motion.h1>

      <div className="relative mb-6">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base-500"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a username…"
          className="w-full rounded-xl border border-hairline-strong bg-base-850 py-3 pl-10 pr-4 text-base text-base-100 placeholder:text-base-500 transition-all duration-200 focus:border-accent-500/60 focus:ring-4 focus:ring-accent-500/10 sm:text-sm"
        />
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-base-850/70" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-base-500">
          {users.length === 0 ? 'No one has registered yet.' : `No one matches “${query}”.`}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((u, i) => (
            <motion.li
              key={u.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-base-850/60 p-3 transition-colors duration-200 hover:bg-base-800/70"
            >
              <Link to={`/u/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-sm font-semibold text-accent-300 ring-1 ring-accent-500/20">
                  {u.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-base-100">
                    @{u.username}
                    {me?.id === u.id && (
                      <span className="ml-2 rounded-full bg-hover-strong px-2 py-0.5 text-[10px] font-normal text-base-400">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-base-500">
                    {me?.id !== u.id && followerIds.has(u.id) ? 'Follows you · ' : ''}
                    Joined{' '}
                    {new Date(u.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </Link>
              {me && me.id !== u.id && (
                <FollowButton
                  isFollowing={followingIds.has(u.id)}
                  saving={savingId === u.id}
                  onFollow={() => handleFollow(u.id)}
                  onUnfollow={() => handleUnfollow(u.id)}
                />
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}
