import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'
import {
  fetchFollowerIds,
  fetchFollowersWithUsers,
  fetchFollowingIds,
  fetchFollowingWithUsers,
  followUser,
  unfollowUser,
} from '../lib/follows'
import FollowButton from './FollowButton'
import type { AppUser } from '../types'

interface FollowListPanelProps {
  /** Whose followers/following list this is -- not necessarily the viewer. */
  userId: string
  mode: 'followers' | 'following'
  onClose: () => void
  /** Called with +1/-1 whenever a follow/unfollow *inside this panel*
   * succeeds -- lets the caller keep its own "N following" count in sync.
   * Only meaningful when the panel is showing the viewer's own profile: the
   * only count that can ever change from actions taken in here is the
   * viewer's own following count (nobody in this list can ever be the
   * viewer, since you can't follow yourself), so callers viewing someone
   * else's list can safely omit this. */
  onMyFollowingCountChange?: (delta: number) => void
}

/** Inline followers/following list, opened from the count buttons on
 * Profile/PublicProfile. Every row gets its own Follow/Unfollow button (for
 * the *viewer's* relationship to that person, not the profile owner's) plus
 * a "Follows you" badge -- so browsing someone else's followers is also a
 * place to follow people back. */
export default function FollowListPanel({ userId, mode, onClose, onMyFollowingCountChange }: FollowListPanelProps) {
  const { user: me } = useAuth()
  const [people, setPeople] = useState<AppUser[]>([])
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set())
  const [myFollowerIds, setMyFollowerIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEscapeAndFocusReturn(true, onClose)

  useEffect(() => {
    if (!me) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      mode === 'followers' ? fetchFollowersWithUsers(userId) : fetchFollowingWithUsers(userId),
      fetchFollowingIds(me.id),
      fetchFollowerIds(me.id),
    ])
      .then(([list, followingIds, followerIds]) => {
        if (!cancelled) {
          setPeople(list)
          setMyFollowingIds(followingIds)
          setMyFollowerIds(followerIds)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load this list.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, mode, me])

  async function handleFollow(targetId: string) {
    if (!me) return
    setSavingId(targetId)
    setMyFollowingIds((prev) => new Set(prev).add(targetId))
    onMyFollowingCountChange?.(1)
    try {
      await followUser(me.id, targetId)
    } catch {
      setMyFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
      onMyFollowingCountChange?.(-1)
      setError('Failed to follow. Try again.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleUnfollow(targetId: string) {
    if (!me) return
    setSavingId(targetId)
    setMyFollowingIds((prev) => {
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })
    onMyFollowingCountChange?.(-1)
    try {
      await unfollowUser(me.id, targetId)
    } catch {
      setMyFollowingIds((prev) => new Set(prev).add(targetId))
      onMyFollowingCountChange?.(1)
      setError('Failed to unfollow. Try again.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-hairline-strong bg-base-900 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-500">
          {mode === 'followers' ? 'Followers' : 'Following'}
        </p>
        <button type="button" onClick={onClose} className="text-xs text-base-500 hover:text-base-300">
          Close
        </button>
      </div>

      {error && <p className="mb-3 text-xs text-danger">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-base-850/70" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <p className="py-4 text-center text-xs text-base-500">
          {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors duration-200 hover:bg-hover">
              <Link to={`/u/${p.username}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-[11px] font-semibold text-accent-300 ring-1 ring-accent-500/20">
                  {p.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-base-100">@{p.username}</p>
                  {myFollowerIds.has(p.id) && <p className="text-[10px] text-base-500">Follows you</p>}
                </div>
              </Link>
              {me && me.id !== p.id && (
                <FollowButton
                  size="sm"
                  isFollowing={myFollowingIds.has(p.id)}
                  saving={savingId === p.id}
                  onFollow={() => handleFollow(p.id)}
                  onUnfollow={() => handleUnfollow(p.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
