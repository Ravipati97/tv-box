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

/** Same as fetchWatchedForShow but ordered, for the per-show watch-history view. */
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
  episodes: { seasonNumber: number; episodeNumber: number; episodeName?: string | null }[]
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
