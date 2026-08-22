import { dayKey } from './date'
import type {
  EpisodeWatched,
  EpisodeWatchedWithUser,
  Follow,
  SeasonRatingWithUser,
  ShowRating,
  ShowRatingWithUser,
  ShowRewatch,
  ShowStarted,
  ShowWatchingDismissed,
} from '../types'

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
  /** True if explicitly removed from Now Watching (show_watching_dismissed).
   * Doesn't affect watchedCount/finished/etc -- purely a Home display
   * suppression, see nowWatching() below. */
  dismissed: boolean
}

/** Merges show_ratings + episode_watched (+ optional show_started,
 * show_watching_dismissed) rows for one user into one summary per show.
 * `started`/`dismissed` default to empty since only Home's Now Watching view
 * needs them -- other callers (Recap, ProfileActivity) don't render a 0/x
 * state or a remove button and can skip fetching either. */
export function summarizeShowActivity(
  ratings: ShowRating[],
  watched: EpisodeWatched[],
  started: ShowStarted[] = [],
  dismissed: ShowWatchingDismissed[] = [],
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
        dismissed: false,
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

  // Dismissed rows only ever target a show that's already in the map (you
  // can only dismiss something currently showing in Now Watching) -- a
  // missing entry means the underlying rating/watched/started rows were
  // removed some other way, in which case there's nothing left to suppress.
  for (const d of dismissed) {
    const entry = map.get(d.show_id)
    if (entry) entry.dismissed = true
  }

  return Array.from(map.values())
}

/** In-progress shows -- watched something, or explicitly started (0/x),
 * not finished, not dismissed -- most recently watched (or started) first. */
export function nowWatching(summaries: ShowActivity[]): ShowActivity[] {
  return summaries
    .filter((s) => (s.watchedCount > 0 || s.started) && !s.finished && !s.dismissed)
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

// --- Personal diary (one user's own dated log, most recent first) ---

export type DiaryEntryKind = 'watched' | 'rated' | 'rewatched'

/** One diary-worthy, personally-dated event. `watched` entries are grouped
 * per show per calendar day (see buildDiaryEntries) -- a 6-episode binge
 * session is one entry, not six, the same granularity every other
 * show-level view in this app already uses. */
export interface DiaryEntry {
  id: string
  kind: DiaryEntryKind
  showId: number
  showName: string
  showPosterPath: string | null
  /** ISO timestamp used for sorting -- empty string for undated entries
   * (see buildUndatedDiaryEntries), which are never mixed into the sorted
   * list this drives. */
  at: string
  /** Set for a standalone 'rated' entry, or merged onto a same-day
   * 'watched'/'rewatched' entry for the same show -- logging and rating a
   * show on the same day is one diary row, not two (matches how
   * Letterboxd/Serializd treat a log + rating as a single entry). */
  rating?: number
  episodeCount?: number
  /** Only set when episodeCount > 1 and episodeLabel isn't (i.e. the
   * episodes span more than one season, so no single "S2E4-E6" range makes
   * sense) -- a single-episode entry shows episodeLabel instead. */
  seasonLabel?: string
  /** A specific episode or contiguous range within one season, e.g.
   * "S2E4 · Man of the People" (single episode) or "S2E4-E6" (a same-day,
   * same-season binge). Left unset for a scattered/cross-season group,
   * which falls back to episodeCount + seasonLabel instead. */
  episodeLabel?: string
}

function seasonLabelFor(seasonNumbers: number[]): string {
  const sorted = Array.from(new Set(seasonNumbers)).sort((a, b) => a - b)
  if (sorted.length === 1) return `Season ${sorted[0]}`
  return `S${sorted[0]}–S${sorted[sorted.length - 1]}`
}

/**
 * "S2E4-E6" for a same-day, same-season binge of more than one episode --
 * more useful at a glance than a bare episode count, since it says exactly
 * which episodes. Returns undefined (caller falls back to seasonLabelFor)
 * when the episodes span more than one season, or are scattered enough
 * (more than 4, non-contiguous) that a range/list would stop being readable.
 */
function episodeRangeLabel(rows: EpisodeWatched[]): string | undefined {
  const seasons = new Set(rows.map((r) => r.season_number))
  if (seasons.size > 1) return undefined
  const season = rows[0].season_number
  const nums = Array.from(new Set(rows.map((r) => r.episode_number))).sort((a, b) => a - b)
  const isContiguous = nums[nums.length - 1] - nums[0] + 1 === nums.length
  if (isContiguous) return `S${season}E${nums[0]}-E${nums[nums.length - 1]}`
  if (nums.length <= 4) return `S${season}E${nums.join(', E')}`
  return undefined
}

/**
 * Merges one user's ratings, watched episodes, and rewatches into a single
 * reverse-chronological diary -- the same idea as a film-tracking diary,
 * just at "episode(s) of a show, in one sitting" granularity for TV.
 * Excludes watched rows with no real date (watched_at_unknown) -- a diary
 * is fundamentally date-ordered, so those live in buildUndatedDiaryEntries
 * instead rather than being silently dropped.
 *
 * A rating logged the same day as watching (or rewatching) that same show
 * merges onto that entry instead of getting its own row -- watching an
 * episode and rating the show afterwards in the same sitting is one action
 * from the diary's point of view, not two. Watched entries claim the merge
 * slot for a (show, day) pair before rewatches do, since watched carries the
 * more specific "what actually happened" detail.
 */
export function buildDiaryEntries(
  ratings: ShowRating[],
  watched: EpisodeWatched[],
  rewatches: ShowRewatch[],
): DiaryEntry[] {
  const entries: DiaryEntry[] = []
  // Tracks which entry (if any) a same-day rating for this show should
  // merge onto -- populated by the watched/rewatched passes below, read by
  // the ratings pass after.
  const mergeTarget = new Map<string, DiaryEntry>()

  const watchedGroups = new Map<string, EpisodeWatched[]>()
  for (const w of watched) {
    if (w.watched_at_unknown) continue
    const key = `${w.show_id}-${dayKey(w.watched_at)}`
    const list = watchedGroups.get(key)
    if (list) list.push(w)
    else watchedGroups.set(key, [w])
  }
  for (const [key, rows] of watchedGroups) {
    // Latest episode in the group stands in for the whole entry's timestamp
    // and poster/name -- so a same-day binge still sorts correctly against
    // a rating or rewatch logged the same day.
    const latest = rows.reduce((a, b) => (b.watched_at > a.watched_at ? b : a))
    const range = rows.length > 1 ? episodeRangeLabel(rows) : undefined
    const entry: DiaryEntry = {
      id: `watched-${latest.show_id}-${dayKey(latest.watched_at)}`,
      kind: 'watched',
      showId: latest.show_id,
      showName: latest.show_name,
      showPosterPath: latest.show_poster_path,
      at: latest.watched_at,
      episodeCount: rows.length,
      seasonLabel: rows.length > 1 && !range ? seasonLabelFor(rows.map((r) => r.season_number)) : undefined,
      episodeLabel:
        rows.length === 1
          ? `S${latest.season_number}E${latest.episode_number}${latest.episode_name ? ` · ${latest.episode_name}` : ''}`
          : range,
    }
    entries.push(entry)
    mergeTarget.set(key, entry)
  }

  for (const rw of rewatches) {
    const entry: DiaryEntry = {
      id: `rewatched-${rw.id}`,
      kind: 'rewatched',
      showId: rw.show_id,
      showName: rw.show_name,
      showPosterPath: rw.show_poster_path,
      at: rw.rewatched_at,
    }
    entries.push(entry)
    const key = `${rw.show_id}-${dayKey(rw.rewatched_at)}`
    // Don't let a rewatch steal the merge slot from a watched entry that's
    // already claimed it for this show/day -- still logged as its own row
    // above, just not where a same-day rating would land.
    if (!mergeTarget.has(key)) mergeTarget.set(key, entry)
  }

  for (const r of ratings) {
    const key = `${r.show_id}-${dayKey(r.rated_at)}`
    const target = mergeTarget.get(key)
    if (target) {
      target.rating = r.rating
    } else {
      entries.push({
        id: `rated-${r.id}`,
        kind: 'rated',
        showId: r.show_id,
        showName: r.show_name,
        showPosterPath: r.show_poster_path,
        at: r.rated_at,
        rating: r.rating,
      })
    }
  }

  entries.sort((a, b) => b.at.localeCompare(a.at))
  return entries
}

/** Watched episodes with no real date ("watched a while ago") -- can't be
 * placed in a dated diary, so they're grouped by show only (no day
 * grouping possible) and surfaced separately rather than silently
 * vanishing from the diary entirely. */
export function buildUndatedDiaryEntries(watched: EpisodeWatched[]): DiaryEntry[] {
  const groups = new Map<number, EpisodeWatched[]>()
  for (const w of watched) {
    if (!w.watched_at_unknown) continue
    const list = groups.get(w.show_id)
    if (list) list.push(w)
    else groups.set(w.show_id, [w])
  }
  return Array.from(groups.values())
    .map((rows) => ({
      id: `watched-undated-${rows[0].show_id}`,
      kind: 'watched' as const,
      showId: rows[0].show_id,
      showName: rows[0].show_name,
      showPosterPath: rows[0].show_poster_path,
      at: '',
      episodeCount: rows.length,
      seasonLabel: rows.length > 1 ? seasonLabelFor(rows.map((r) => r.season_number)) : undefined,
      episodeLabel:
        rows.length === 1 ? `S${rows[0].season_number}E${rows[0].episode_number}` : undefined,
    }))
    .sort((a, b) => a.showName.localeCompare(b.showName))
}

// --- Group activity feed (every member's ratings/finishes, merged) ---

export interface GroupActivityEvent {
  /** Discriminates this from FollowActivityEvent in a merged feed (see
   * mergeActivityFeed below) -- lets Activity.tsx pick the right row
   * component without a shape check. */
  kind: 'show'
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
  /** Set only for a season-level rating event -- distinguishes "rated
   * Season 2" from a show-level "rated" event, which leaves this null. */
  seasonNumber: number | null
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
 * there too. Season ratings are appended separately (see below) since
 * they're independent of a show's overall watch/rating state -- someone can
 * rate a season without that changing whether the show itself would show up
 * in their History tab, so routing them through the same
 * summarizeShowActivity/watchHistory filter would drop most of them.
 */
export function buildGroupActivity(
  ratings: ShowRatingWithUser[],
  watched: EpisodeWatchedWithUser[],
  seasonRatings: SeasonRatingWithUser[] = [],
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
        kind: 'show',
        key: `${userId}-${s.showId}`,
        userId,
        username: bucket.username,
        showId: s.showId,
        showName: s.showName,
        showPosterPath: s.showPosterPath,
        rating: s.rating,
        finished: s.finished,
        episodeCount: s.finished ? s.totalEpisodes : null,
        seasonNumber: null,
        at,
        atUnknown: s.finished ? s.finishedAtUnknown : false,
      })
    }
  }

  // Appended directly rather than bucketed above -- a season rating always
  // shows up here regardless of the show's overall progress/rating state.
  for (const sr of seasonRatings) {
    events.push({
      kind: 'show',
      key: `${sr.user_id}-${sr.show_id}-season-${sr.season_number}`,
      userId: sr.user_id,
      username: sr.users?.username ?? 'unknown',
      showId: sr.show_id,
      showName: sr.show_name,
      showPosterPath: sr.show_poster_path,
      rating: sr.rating,
      finished: false,
      episodeCount: null,
      seasonNumber: sr.season_number,
      at: sr.rated_at,
      atUnknown: false,
    })
  }

  events.sort((a, b) => b.at.localeCompare(a.at))
  return events
}

// --- Group activity feed, follow events (who-followed-whom) ---

export interface FollowActivityEvent {
  kind: 'follow'
  /** One entry per follow edge -- an unfollow just removes it from the next
   * fetch, same as everything else here (nothing is soft-deleted). */
  key: string
  followerId: string
  followerUsername: string
  followedId: string
  followedUsername: string
  at: string
  /** Always false -- a follow's created_at is always a real timestamp,
   * never a placeholder. Present purely so FollowActivityEvent and
   * GroupActivityEvent can share the same day-grouping code in Activity.tsx. */
  atUnknown: false
}

/** Turns raw follow edges into feed-ready events, resolving both sides'
 * usernames against a shared lookup (the same `members` list Activity.tsx
 * already fetches for its person-filter chips). An edge whose follower or
 * followed id isn't in the lookup is skipped rather than rendered with a
 * fabricated "unknown" username -- shouldn't happen since both ids always
 * reference a real users row, but a stale/deleted account shouldn't produce
 * a broken-looking row. */
export function buildFollowActivity(follows: Follow[], usernameById: Map<string, string>): FollowActivityEvent[] {
  const events: FollowActivityEvent[] = []
  for (const f of follows) {
    const followerUsername = usernameById.get(f.follower_id)
    const followedUsername = usernameById.get(f.followed_id)
    if (!followerUsername || !followedUsername) continue
    events.push({
      kind: 'follow',
      key: `follow-${f.id}`,
      followerId: f.follower_id,
      followerUsername,
      followedId: f.followed_id,
      followedUsername,
      at: f.created_at,
      atUnknown: false,
    })
  }
  return events
}

export type ActivityFeedItem = GroupActivityEvent | FollowActivityEvent

/** Merges show events and follow events into one reverse-chronological feed. */
export function mergeActivityFeed(
  showEvents: GroupActivityEvent[],
  followEvents: FollowActivityEvent[],
): ActivityFeedItem[] {
  return [...showEvents, ...followEvents].sort((a, b) => b.at.localeCompare(a.at))
}
