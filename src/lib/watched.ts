import { supabase } from './supabase'
import type { EpisodeWatched, EpisodeWatchedWithUser, WatchedMap } from '../types'

export function watchedKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}-${episodeNumber}`
}

/**
 * Placeholder timestamp for "watched at some point, don't know when" -- the
 * column is NOT NULL so we still need a value, and epoch sorts before every
 * real watch date, so unknown-date entries naturally fall to the back of any
 * "most recent" sort without special-casing. Never shown to the user
 * directly -- always paired with watched_at_unknown, which is what the UI
 * actually checks before rendering a date.
 */
export const UNKNOWN_WATCHED_AT = new Date(0).toISOString()

/** All of one user's watched episodes for a show (every season), keyed for quick lookup. */
export async function fetchWatchedForShow(userId: string, showId: number): Promise<WatchedMap> {
  const { data, error } = await supabase
    .from('episode_watched')
    .select('*')
    .eq('user_id', userId)
    .eq('show_id', showId)

  if (error) throw error
  const rows = (data ?? []) as EpisodeWatched[]
  const map: WatchedMap = {}
  for (const row of rows) map[watchedKey(row.season_number, row.episode_number)] = row
  return map
}

/** Same as fetchWatchedForShow but ordered, for the per-show watch-history view.
 * Bulk actions ("mark season/show watched") stamp every row in the batch with
 * the exact same watched_at, so watched_at alone leaves ties in whatever order
 * Postgres feels like returning them -- season/episode number (descending)
 * breaks those ties deterministically instead of the list looking shuffled. */
export async function fetchWatchedForUserAndShow(
  userId: string,
  showId: number,
): Promise<EpisodeWatched[]> {
  const { data, error } = await supabase
    .from('episode_watched')
    .select('*')
    .eq('user_id', userId)
    .eq('show_id', showId)
    .order('watched_at', { ascending: false })
    .order('season_number', { ascending: false })
    .order('episode_number', { ascending: false })

  if (error) throw error
  return (data ?? []) as EpisodeWatched[]
}

export async function fetchRecentWatched(userId: string, limit = 2000): Promise<EpisodeWatched[]> {
  const { data, error } = await supabase
    .from('episode_watched')
    .select('*')
    .eq('user_id', userId)
    .order('watched_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as EpisodeWatched[]
}

/** Most recent watched-episode rows across the whole group (every user), for the group
 * Activity feed -- used to work out who just finished a show, not shown episode-by-episode. */
export async function fetchRecentWatchedAllUsers(limit = 1500): Promise<EpisodeWatchedWithUser[]> {
  const { data, error } = await supabase
    .from('episode_watched')
    .select('*, users(username)')
    .order('watched_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as EpisodeWatchedWithUser[]
}

export interface MarkWatchedInput {
  userId: string
  showId: number
  showName: string
  showPosterPath: string | null
  showTotalEpisodes: number | null
  seasonNumber: number
  episodeNumber: number
  episodeName: string | null
  /** Episode runtime in minutes, if known -- powers the "hours watched" stat. */
  runtimeMinutes?: number | null
}

export async function markWatched(input: MarkWatchedInput): Promise<EpisodeWatched> {
  const { data, error } = await supabase
    .from('episode_watched')
    .upsert(
      {
        user_id: input.userId,
        show_id: input.showId,
        show_name: input.showName,
        show_poster_path: input.showPosterPath,
        show_total_episodes: input.showTotalEpisodes,
        season_number: input.seasonNumber,
        episode_number: input.episodeNumber,
        episode_name: input.episodeName,
        watched_at: new Date().toISOString(),
        // Real-time single toggle -- always a known, current date, even if
        // this episode previously carried an unknown-date bulk mark.
        watched_at_unknown: false,
        runtime_minutes: input.runtimeMinutes ?? null,
      },
      { onConflict: 'user_id,show_id,season_number,episode_number' },
    )
    .select()
    .single()

  if (error) throw error
  return data as EpisodeWatched
}

export interface BulkMarkWatchedInput {
  userId: string
  showId: number
  showName: string
  showPosterPath: string | null
  showTotalEpisodes: number | null
  episodes: {
    seasonNumber: number
    episodeNumber: number
    episodeName?: string | null
    /** Episode runtime in minutes, if known -- powers the "hours watched" stat. */
    runtimeMinutes?: number | null
  }[]
  /** ISO timestamp stamped on every row -- lets a bulk log land on the right date in History. */
  watchedAt: string
  /** True if watchedAt is just UNKNOWN_WATCHED_AT rather than a real date. */
  watchedAtUnknown?: boolean
}

/**
 * Marks many episodes watched in one request (e.g. "mark this whole show/season
 * watched" for something seen before you started using TV Box). Far cheaper
 * than looping markWatched() per episode -- one upsert, one round trip.
 */
export async function bulkMarkWatched(input: BulkMarkWatchedInput): Promise<EpisodeWatched[]> {
  if (input.episodes.length === 0) return []
  const rows = input.episodes.map((ep) => ({
    user_id: input.userId,
    show_id: input.showId,
    show_name: input.showName,
    show_poster_path: input.showPosterPath,
    show_total_episodes: input.showTotalEpisodes,
    season_number: ep.seasonNumber,
    episode_number: ep.episodeNumber,
    episode_name: ep.episodeName ?? null,
    watched_at: input.watchedAt,
    watched_at_unknown: input.watchedAtUnknown ?? false,
    runtime_minutes: ep.runtimeMinutes ?? null,
  }))

  const { data, error } = await supabase
    .from('episode_watched')
    .upsert(rows, { onConflict: 'user_id,show_id,season_number,episode_number' })
    .select()

  if (error) throw error
  return (data ?? []) as EpisodeWatched[]
}

export async function unmarkWatched(
  userId: string,
  showId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from('episode_watched')
    .delete()
    .eq('user_id', userId)
    .eq('show_id', showId)
    .eq('season_number', seasonNumber)
    .eq('episode_number', episodeNumber)

  if (error) throw error
}

/**
 * Restores episode_watched rows to an exact prior state -- used only to
 * undo a bulk action that just overwrote them. Unlike markWatched (always
 * "now") or bulkMarkWatched (one shared date for the whole batch), this
 * preserves each row's own original watched_at/watched_at_unknown, since
 * that's the whole point of an undo.
 */
export async function restoreWatched(rows: EpisodeWatched[]): Promise<EpisodeWatched[]> {
  if (rows.length === 0) return []
  const payload = rows.map((r) => ({
    user_id: r.user_id,
    show_id: r.show_id,
    show_name: r.show_name,
    show_poster_path: r.show_poster_path,
    show_total_episodes: r.show_total_episodes,
    season_number: r.season_number,
    episode_number: r.episode_number,
    episode_name: r.episode_name,
    watched_at: r.watched_at,
    watched_at_unknown: r.watched_at_unknown,
  }))
  const { data, error } = await supabase
    .from('episode_watched')
    .upsert(payload, { onConflict: 'user_id,show_id,season_number,episode_number' })
    .select()

  if (error) throw error
  return (data ?? []) as EpisodeWatched[]
}

/**
 * Deletes many episode_watched rows in one request -- used to undo a bulk
 * mark that created brand-new rows (the ones that didn't exist before, so
 * "undo" means removing them rather than restoring an old value). Supabase
 * doesn't support an OR-of-tuples filter directly, so this builds one
 * `and(...)` clause per episode and ORs them together -- fine at the sizes
 * a single show ever has.
 */
export async function bulkUnmarkWatched(
  userId: string,
  showId: number,
  episodes: { seasonNumber: number; episodeNumber: number }[],
): Promise<void> {
  if (episodes.length === 0) return
  const orFilter = episodes
    .map((e) => `and(season_number.eq.${e.seasonNumber},episode_number.eq.${e.episodeNumber})`)
    .join(',')
  const { error } = await supabase
    .from('episode_watched')
    .delete()
    .eq('user_id', userId)
    .eq('show_id', showId)
    .or(orFilter)

  if (error) throw error
}
