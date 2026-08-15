import { Link } from 'react-router-dom'
import { posterUrl } from '../lib/tmdb'
import { formatShortDate } from '../lib/date'
import type { GroupActivityEvent } from '../lib/showActivity'

function StarGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}

/** One "who did what" row -- shared by the Home teaser and the full Activity feed. */
export default function ActivityRow({ event }: { event: GroupActivityEvent }) {
  return (
    <Link
      to={`/u/${event.username}/shows/${event.showId}`}
      className="flex items-center gap-3 rounded-xl border border-hairline bg-base-850/60 p-2.5 transition-colors duration-200 hover:bg-base-800/70"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-xs font-semibold text-accent-300 ring-1 ring-accent-500/20">
        {event.username.slice(0, 2).toUpperCase()}
      </div>
      <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-base-800">
        {event.showPosterPath && (
          <img
            src={posterUrl(event.showPosterPath, 'w185') ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-base-200">
          <span className="font-medium text-base-100">@{event.username}</span>{' '}
          {event.finished ? 'finished' : 'rated'} <span className="font-medium">{event.showName}</span>
        </p>
        <p className="text-xs text-base-500">
          {event.atUnknown ? 'a while ago' : formatShortDate(event.at)}
          {event.finished && event.episodeCount ? ` · ${event.episodeCount} episodes` : ''}
        </p>
      </div>
      {event.rating !== null && (
        <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-star">
          {event.rating.toFixed(1)}
          <StarGlyph />
        </div>
      )}
    </Link>
  )
}
