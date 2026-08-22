import { Link } from 'react-router-dom'
import { formatShortDate } from '../lib/date'
import type { FollowActivityEvent } from '../lib/showActivity'

/** One "X started following Y" row -- same layout language as ActivityRow
 * (avatar, thumbnail slot, text block, right-aligned bit) but the thumbnail
 * slot holds a follow glyph instead of a poster, since there's no show
 * involved. Links to the person who was followed, mirroring ActivityRow
 * linking to the show that was rated/finished. */
export default function FollowActivityRow({ event }: { event: FollowActivityEvent }) {
  return (
    <Link
      to={`/u/${event.followedUsername}`}
      className="flex items-center gap-3 rounded-xl border border-hairline bg-base-850/60 p-2.5 transition-colors duration-200 hover:bg-base-800/70"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-xs font-semibold text-accent-300 ring-1 ring-accent-500/20">
        {event.followerUsername.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md bg-base-800 text-accent-400">
        <FollowGlyph />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-base-200">
          <span className="font-medium text-base-100">@{event.followerUsername}</span> started following{' '}
          <span className="font-medium text-base-100">@{event.followedUsername}</span>
        </p>
        <p className="text-xs text-base-500">{formatShortDate(event.at)}</p>
      </div>
    </Link>
  )
}

function FollowGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c1.2-3.4 4-5.2 6.5-5.2s5.3 1.8 6.5 5.2" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  )
}
