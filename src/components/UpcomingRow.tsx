import { Link } from 'react-router-dom'
import { posterUrl } from '../lib/tmdb'
import { formatShortDate } from '../lib/date'

export interface UpcomingItem {
  showId: number
  showName: string
  showPosterPath: string | null
  seasonNumber: number
  episodeNumber: number
  airDate: string
}

/** One "what's airing next" row for Home's Upcoming list -- mirrors
 * ActivityRow's layout (poster thumbnail, text block, right-aligned pill) so
 * the two sections read as the same visual language. */
export default function UpcomingRow({ item }: { item: UpcomingItem }) {
  return (
    <Link
      to={`/show/${item.showId}`}
      className="flex items-center gap-3 rounded-xl border border-hairline bg-base-850/60 p-2.5 transition-colors duration-200 hover:bg-base-800/70"
    >
      <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-base-800">
        {item.showPosterPath && (
          <img
            src={posterUrl(item.showPosterPath, 'w185') ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-base-100">{item.showName}</p>
        <p className="text-xs text-base-500">
          Season {item.seasonNumber} · Episode {item.episodeNumber}
        </p>
      </div>
      <div className="shrink-0 rounded-full bg-accent-500/10 px-2.5 py-1 text-xs font-medium text-accent-400">
        {formatShortDate(item.airDate)}
      </div>
    </Link>
  )
}
