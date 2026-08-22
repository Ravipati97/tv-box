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
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
    setIsFollowing(true)
    setCounts((c) => ({ ...c, followers: c.followers + 1 }))
    try {
      await followUser(me.id, profileId)
    } catch {
      setIsFollowing(false)
      setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }))
      setError('Failed to follow. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUnfollow() {
    if (!me) return
    setSaving(true)
    setError(null)
    setIsFollowing(false)
    setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }))
    try {
      await unfollowUser(me.id, profileId)
    } catch {
      setIsFollowing(true)
      setCounts((c) => ({ ...c, followers: c.followers + 1 }))
      setError('Failed to unfollow. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // Only meaningful for your own profile: nobody in a followers/following
  // list can ever be you (you can't follow yourself), so the only count
  // that could ever change from actions taken *inside* that panel is your
  // own following count -- and only when the panel IS your own profile's.
  function handlePanelFollowingCountChange(delta: number) {
    setCounts((c) => ({ ...c, following: Math.max(0, c.following + delta) }))
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
          // Default (md) size here, not "sm" -- this is a primary action on
          // a spacious profile header, not a dense list row like Members.tsx
          // or FollowListPanel, so it should get a comfortable touch target
          // (44px+ tall) rather than the same compact sizing those use.
          <FollowButton isFollowing={isFollowing} saving={saving} onFollow={handleFollow} onUnfollow={handleUnfollow} />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      {panel && (
        <FollowListPanel
          userId={profileId}
          mode={panel}
          onClose={() => setPanel(null)}
          onMyFollowingCountChange={isMe ? handlePanelFollowingCountChange : undefined}
        />
      )}
    </div>
  )
}
