import { supabase } from './supabase'
import type { CrowdMap, EpisodeRating, EpisodeRatingWithUser, RatingMap } from '../types'

export function ratingKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}-${episodeNumber}`
}

/**
 * Every rating (from every user) for a given show, joined with each rater's
 * username. Used to show both "my" rating and the crowd's ratings on each
 * episode row in one query.
 */
export async function fetchAllRatingsForShow(showId: number): Promise<EpisodeRatingWithUser[]> {
  const { data, error } = await supabase
    .from('episode_ratings')
    .select('*, users(username)')
    .eq('show_id', showId)

  if (error) throw error
  return (data ?? []) as unknown as EpisodeRatingWithUser[]
}

/** Splits an all-users rating list into "my ratings" (RatingMap) + "everyone's ratings" (CrowdMap). */
export function splitRatingsByUser(
  rows: EpisodeRatingWithUser[],
  myUserId: string,
): { mine: RatingMap; crowd: CrowdMap } {
  const mine: RatingMap = {}
  const crowd: CrowdMap = {}
  for (const row of rows) {
    const key = ratingKey(row.season_number, row.episode_number)
    if (row.user_id === myUserId) mine[key] = row
    if (!crowd[key]) crowd[key] = []
    crowd[key].push(row)
  }
  return { mine, crowd }
}

export async function fetchRecentRatings(userId: string, limit = 60): Promise<EpisodeRating[]> {
  const { data, error } = await supabase
    .from('episode_ratings')
    .select('*')
    .eq('user_id', userId)
    .order('rated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as EpisodeRating[]
}

export interface UpsertRatingInput {
  userId: string
  showId: number
  showName: string
  showPosterPath: string | null
  seasonNumber: number
  episodeNumber: number
  episodeName: string | null
  rating: number
}

export async function upsertRating(input: UpsertRatingInput): Promise<EpisodeRating> {
  const { data, error } = await supabase
    .from('episode_ratings')
    .upsert(
      {
        user_id: input.userId,
        show_id: input.showId,
        show_name: input.showName,
        show_poster_path: input.showPosterPath,
        season_number: input.seasonNumber,
        episode_number: input.episodeNumber,
        episode_name: input.episodeName,
        rating: input.rating,
        rated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,show_id,season_number,episode_number' },
    )
    .select()
    .single()

  if (error) throw error
  return data as EpisodeRating
}

export async function deleteRating(
  userId: string,
  showId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from('episode_ratings')
    .delete()
    .eq('user_id', userId)
    .eq('show_id', showId)
    .eq('season_number', seasonNumber)
    .eq('episode_number', episodeNumber)

  if (error) throw error
}
