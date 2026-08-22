import { useState } from 'react'

interface FollowButtonProps {
  isFollowing: boolean
  saving?: boolean
  onFollow: () => void
  onUnfollow: () => void
  size?: 'sm' | 'md'
}

// Checked once at module load, not per-render -- a device's hover capability
// doesn't change mid-session. Gates the hover-to-"Unfollow" relabel below:
// touch browsers frequently fire a synthetic mouseenter on tap with no
// matching mouseleave (nothing "leaves" without a second tap elsewhere), so
// without this check a tap would leave the button stuck showing "Unfollow"
// styling right after a successful follow -- the same class of bug
// useDesktopAutoFocus (src/hooks/useDesktopAutoFocus.ts) exists to avoid for
// autofocus. `hover: hover` (not just `pointer: fine`) is the more precise
// check here since it's specifically about whether hover *events* are real.
const supportsHover =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : false

/** Follow/Unfollow toggle -- controlled by the caller (isFollowing/saving
 * are read from parent state, not fetched here), so a page listing many
 * people (Find People, FollowListPanel) can hold one shared following-set
 * instead of every row independently re-fetching its own status. Hovering a
 * "Following" button relabels it "Unfollow" (desktop only -- touch just taps
 * straight through, the same pattern Twitter/Instagram use). */
export default function FollowButton({
  isFollowing,
  saving = false,
  onFollow,
  onUnfollow,
  size = 'md',
}: FollowButtonProps) {
  const [hovering, setHovering] = useState(false)
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
  const label = isFollowing ? (hovering ? 'Unfollow' : 'Following') : 'Follow'

  return (
    <button
      type="button"
      disabled={saving}
      aria-label={isFollowing ? 'Unfollow' : 'Follow'}
      onClick={() => (isFollowing ? onUnfollow() : onFollow())}
      onMouseEnter={() => supportsHover && setHovering(true)}
      onMouseLeave={() => supportsHover && setHovering(false)}
      className={`shrink-0 rounded-full font-medium transition-colors duration-200 disabled:opacity-50 ${sizeClasses} ${
        isFollowing
          ? hovering
            ? 'bg-danger/10 text-danger ring-1 ring-danger/40'
            : 'bg-hover-strong text-base-300 ring-1 ring-hairline-strong'
          : 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40 hover:bg-accent-500/25'
      }`}
    >
      {saving ? '…' : label}
    </button>
  )
}
