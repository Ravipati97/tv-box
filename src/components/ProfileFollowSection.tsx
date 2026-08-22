import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchFollowCounts, followUser, isFollowingUser, unfollowUser } from '../lib/follows'
import FollowButton from './FollowButton'
import FollowListPanel from './FollowListPanel'

interface ProfileFollowSectionProps {
  profileId: string
  isMe: boolean
}

/** Follower/following counts (clickable, opening FollowListPanel) plus a
 * Follow/Unfollow button for someone else's profile -- shared between
 * Profile.tsx (self) and PublicProfile.tsx (others) so the fetch/toggle
 * logic and optimistic-count-update behavior only exist in one place. */
export default function ProfileFollowSection({ profileId, isMe }: ProfileFollowSectionProps) {
  const { user: me } = useAuth()
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [panel, setPanel] = useState<'followers' | 'following' | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchFollowCounts(profileId),
      !isMe && me ? isFollowingUser(me.id, profileId) : Promise.resolve(false),
    ])
      .then(([c, following]) => {
        if (!cancelled) {
          setCounts(c)
          setIsFollowing(following)
        }
      })
      .catch(() => {
        // Silent -- a failed count fetch just leaves the counts at 0 rather
        // than blocking the rest of the profile from rendering.
      })
    return () => {
      cancelled = true
    }
  }, [profileId, isMe, me])

  async function handleFollow() {
    if (!me) return
    setSaving(true)
    setIsFollowing(true)
    setCounts((c) => ({ ...c, followers: c.followers + 1 }))
    try {
      await followUser(me.id, profileId)
    } catch {
      setIsFollowing(false)
      setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }))
    } finally {
      setSaving(false)
    }
  }

  async function handleUnfollow() {
    if (!me) return
    setSaving(true)
    setIsFollowing(false)
    setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }))
    try {
      await unfollowUser(me.id, profileId)
    } catch {
      setIsFollowing(true)
      setCounts((c) => ({ ...c, followers: c.followers + 1 }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPanel('followers')}
          className="text-xs text-base-400 transition-colors duration-200 hover:text-base-200"
        >
          <span className="font-semibold text-base-200">{counts.followers}</span>{' '}
          {counts.followers === 1 ? 'follower' : 'followers'}
        </button>
        <button
          type="button"
          onClick={() => setPanel('following')}
          className="text-xs text-base-400 transition-colors duration-200 hover:text-base-200"
        >
          <span className="font-semibold text-base-200">{counts.following}</span> following
        </button>
        {!isMe && me && (
          <FollowButton size="sm" isFollowing={isFollowing} saving={saving} onFollow={handleFollow} onUnfollow={handleUnfollow} />
        )}
      </div>
      {panel && <FollowListPanel userId={profileId} mode={panel} onClose={() => setPanel(null)} />}
    </div>
  )
}
