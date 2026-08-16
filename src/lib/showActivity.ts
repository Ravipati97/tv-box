import type { EpisodeWatched, EpisodeWatchedWithUser, ShowRating, ShowRatingWithUser, ShowStarted } from '../types'

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
  /** True if lastWatchedAt is a placeholder -- render "watched a while ago", not the date. */
  lastWatchedAtUnknown: boolean
  finished: boolean
  /** Same as lastWatchedAt when finished, for clarity at call sites. */
  finishedAt: string | null
  finishedAtUnknown: boolean
  /** True if explicitly declared "Start watching" (show_started), independent
   * of whether any episode has actually been marked watched yet. */
  started: boolean
  startedAt: string | null
}

/** Merges show_ratings + episode_watched (+ optional show_started) rows for
 * one user into one summary per show. `started` defaults to empty since only
 * Home's Now Watching view needs it -- other callers (Recap, ProfileActivity)
 * don't render a 0/x state and can skip fetching it. */
export function summarizeShowActivity(
  ratings: ShowRating[],
  watched: EpisodeWatched[],
  started: ShowStarted[] = [],
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
        lastWatchedAtUnknown: false,
        finished: false,
        finishedAt: null,
        finishedAtUnknown: false,
        started: false,
        startedAt: null,
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

  for (const s of started) {
    const entry = entryFor(s.show_id, s.show_name, s.show_poster_path)
    entry.started = true
    entry.startedAt = s.started_at
    // Fallback only -- if this show also has real episode_watched rows, the
    // loop below overwrites this with a more current snapshot.
    entry.totalEpisodes = s.show_total_episodes
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
    // Epoch (UNKNOWN_WATCHED_AT) always loses this comparison against a real
    // date, so a show with even one precisely-dated episode correctly picks
    // that as "last watched" -- only an all-unknown show ends up flagged.
    for (const r of rows) {
      if (!entry.lastWatchedAt || r.watched_at > entry.lastWatchedAt) {
        entry.lastWatchedAt = r.watched_at
        entry.lastWatchedAtUnknown = r.watched_at_unknown
      }
    }
    entry.finished = entry.totalEpisodes !== null && entry.watchedCount >= entry.totalEpisodes
    entry.finishedAt = entry.finished ? entry.lastWatchedAt : null
    entry.finishedAtUnknown = entry.finished ? entry.lastWatchedAtUnknown : false
  }

  return Array.from(map.values())
}

/** In-progress shows -- watched something, or explicitly started (0/x),
 * not finished -- most recently watched (or started) first. */
export function nowWatching(summaries: ShowActivity[]): ShowActivity[] {
  return summaries
    .filter((s) => (s.watchedCount > 0 || s.started) && !s.finished)
    .sort((a, b) => (b.lastWatchedAt ?? b.startedAt ?? '').localeCompare(a.lastWatchedAt ?? a.startedAt ?? ''))
}

/**
 * "Done with it" shows: finished (100% watched), or rated without ever
 * tracking episodes. Excludes shows still in progress -- those live in
 * nowWatching() until they're finished. A show that's been explicitly
 * started stays in nowWatching() even if it's also rated with 0 episodes
 * watched, rather than showing up in both places.
 */
export function watchHistory(summaries: ShowActivity[]): ShowActivity[] {
  return summaries.filter((s) => s.finished || (s.rating !== null && s.watchedCount === 0 && !s.started))
}

// 'platform' isn't a plain array sort (it's a grouping -- see HistorySection),
// but it lives in the same picker as the others so it's listed here too.
export type HistorySort = 'recent' | 'rating' | 'finished' | 'name' | 'platform'

export function sortHistory(entries: ShowActivity[], sort: HistorySort): ShowActivity[] {
  const sorted = entries.slice()
  if (sort === 'rating') {
    sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
  } else if (sort === 'name') {
    sorted.sort((a, b) => a.showName.localeCompare(b.showName))
  } else if (sort === 'finished') {
    // Strictly finish date -- shows that were only ever rated (never
    // episode-tracked) have no finishedAt, so they sink to the bottom
    // instead of borrowing their rated date the way "recent" does.
    sorted.sort((a, b) => {
      if (a.finishedAt && b.finishedAt) return b.finishedAt.localeCompare(a.finishedAt)
      if (a.finishedAt) return -1
      if (b.finishedAt) return 1
      return a.showName.localeCompare(b.showName)
    })
  } else {
    sorted.sort((a, b) => {
      const aDate = a.finishedAt ?? a.ratedAt ?? ''
      const bDate = b.finishedAt ?? b.ratedAt ?? ''
      return bDate.localeCompare(aDate)
    })
  }
  return sorted
}

// --- Group activity feed (every member's ratings/finishes, merged) ---

export interface GroupActivityEvent {
  /** userId + showId is unique -- one "entry" per person per show, same as History. */
  key: string
  userId: string
  username: string
  showId: number
  showName: string
  showPosterPath: string | null
  rating: number | null
  finished: boolean
  episodeCount: number | null
  /** finishedAt if finished, otherwise ratedAt -- when this event "happened". */
  at: string
  atUnknown: boolean
}

/**
 * Merges every member's ratings + watched-episode rows into one
 * reverse-chronological feed of "who finished/rated what". Reuses
 * summarizeShowActivity + watchHistory per-user (grouping the flat
 * multi-user rows first) so the semantics exactly match each person's own
 * History tab -- a show only ever shows up here once it would show up
 * there too.
 */
export function buildGroupActivity(
  ratings: ShowRatingWithUser[],
  watched: EpisodeWatchedWithUser[],
): GroupActivityEvent[] {
  interface UserBucket {
    username: string
    ratings: ShowRating[]
    watched: EpisodeWatched[]
  }
  const byUser = new Map<string, UserBucket>()

  function bucketFor(userId: string, username: string | undefined): UserBucket {
    let bucket = byUser.get(userId)
    if (!bucket) {
      bucket = { username: username ?? 'unknown', ratings: [], watched: [] }
      byUser.set(userId, bucket)
    } else if (username) {
      bucket.username = username
    }
    return bucket
  }

  for (const r of ratings) bucketFor(r.user_id, r.users?.username).ratings.push(r)
  for (const w of watched) bucketFor(w.user_id, w.users?.username).watched.push(w)

  const events: GroupActivityEvent[] = []
  for (const [userId, bucket] of byUser) {
    const history = watchHistory(summarizeShowActivity(bucket.ratings, bucket.watched))
    for (const s of history) {
      const at = s.finishedAt ?? s.ratedAt
      if (!at) continue
      events.push({
        key: `${userId}-${s.showId}`,
        userId,
        username: bucket.username,
        showId: s.showId,
        showName: s.showName,
        showPosterPath: s.showPosterPath,
        rating: s.rating,
        finished: s.finished,
        episodeCount: s.finished ? s.totalEpisodes : null,
        at,
        atUnknown: s.finished ? s.finishedAtUnknown : false,
      })
    }
  }

  events.sort((a, b) => b.at.localeCompare(a.at))
  return events
}
