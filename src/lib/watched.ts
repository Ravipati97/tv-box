import { supabase } from './supabase'
import type { EpisodeWatched, WatchedMap } from '../types'

export function watchedKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}-${episodeNumber}`
}

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
      },
      { onConflict: 'user_id,show_id,season_number,episode_number' },
    )
    .select()
    .single()

  if (error) throw error
  return data as EpisodeWatched
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
