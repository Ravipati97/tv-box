import type { EpisodeWatched, ShowRating } from '../types'

/** Per-show rollup combining a rating (if any) with watch progress (if any). */
export interface ShowActivity {
  showId: number
  showName: string
  showPosterPath: string | null
  rating: number | null
  ratedAt: string | null
  watchedCount: number
  /** Snapshot of the show's total episode count, or null if never watched/unknown. */
  totalEpisodes: number | null
  lastWatchedAt: string | null
  finished: boolean
  /** Same as lastWatchedAt when finished, for clarity at call sites. */
  finishedAt: string | null
}

/** Merges show_ratings + episode_watched rows (for one user) into one summary per show. */
export function summarizeShowActivity(
  ratings: ShowRating[],
  watched: EpisodeWatched[],
): ShowActivity[] {
  const map = new Map<number, ShowActivity>()

  function entryFor(showId: number, showName: string, showPosterPath: string | null): ShowActivity {
    let entry = map.get(showId)
    if (!entry) {
      entry = {
        showId,
        showName,
        showPosterPath,
        rating: null,
        ratedAt: null,
        watchedCount: 0,
        totalEpisodes: null,
        lastWatchedAt: null,
        finished: false,
        finishedAt: null,
      }
      map.set(showId, entry)
    }
    return entry
  }

  for (const r of ratings) {
    const entry = entryFor(r.show_id, r.show_name, r.show_poster_path)
    entry.rating = r.rating
    entry.ratedAt = r.rated_at
  }

  const watchedByShow = new Map<number, EpisodeWatched[]>()
  for (const w of watched) {
    const list = watchedByShow.get(w.show_id)
    if (list) list.push(w)
    else watchedByShow.set(w.show_id, [w])
  }

  for (const [showId, rows] of watchedByShow) {
    const entry = entryFor(showId, rows[0].show_name, rows[0].show_poster_path)
    entry.watchedCount = rows.length
    entry.totalEpisodes = rows.reduce<number | null>((max, r) => {
      if (r.show_total_episodes == null) return max
      return max === null ? r.show_total_episodes : Math.max(max, r.show_total_episodes)
    }, null)
    entry.lastWatchedAt = rows.reduce<string | null>(
      (latest, r) => (!latest || r.watched_at > latest ? r.watched_at : latest),
      null,
    )
    entry.finished = entry.totalEpisodes !== null && entry.watchedCount >= entry.totalEpisodes
    entry.finishedAt = entry.finished ? entry.lastWatchedAt : null
  }

  return Array.from(map.values())
}

/** In-progress shows (watched something, not finished), most recently watched first. */
export function nowWatching(summaries: ShowActivity[]): ShowActivity[] {
  return summaries
    .filter((s) => s.watchedCount > 0 && !s.finished)
    .sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? ''))
}

/**
 * "Done with it" shows: finished (100% watched), or rated without ever
 * tracking episodes. Excludes shows still in progress -- those live in
 * nowWatching() until they're finished.
 */
export function watchHistory(summaries: ShowActivity[]): ShowActivity[] {
  return summaries.filter((s) => s.finished || (s.rating !== null && s.watchedCount === 0))
}

export type HistorySort = 'recent' | 'rating' | 'name'

export function sortHistory(entries: ShowActivity[], sort: HistorySort): ShowActivity[] {
  const sorted = entries.slice()
  if (sort === 'rating') {
    sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  } else if (sort === 'name') {
    sorted.sort((a, b) => a.showName.localeCompare(b.showName))
  } else {
    sorted.sort((a, b) => {
      const aDate = a.finishedAt ?? a.ratedAt ?? ''
      const bDate = b.finishedAt ?? b.ratedAt ?? ''
      return bDate.localeCompare(aDate)
    })
  }
  return sorted
}
