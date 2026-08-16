import { supabase } from './supabase'
import type { SeasonRating, SeasonRatingWithUser } from '../types'

/** Every season rating (every user, every season) for a show, joined with
 * usernames -- fetched once per show alongside show_ratings and filtered
 * client-side per active season, the same pattern as episode_watched. */
export async function fetchAllSeasonRatingsForShow(showId: number): Promise<SeasonRatingWithUser[]> {
  const { data, error } = await supabase
    .from('season_ratings')
    .select('*, users(username)')
    .eq('show_id', showId)

  if (error) throw error
  return (data ?? []) as unknown as SeasonRatingWithUser[]
}

/** Most recent season ratings across the whole group (every user), for the
 * group Activity feed -- same shape/purpose as fetchRecentShowRatingsAllUsers
 * in lib/showRatings.ts, just for the season-level table. */
export async function fetchRecentSeasonRatingsAllUsers(limit = 500): Promise<SeasonRatingWithUser[]> {
  const { data, error } = await supabase
    .from('season_ratings')
    .select('*, users(username)')
    .order('rated_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as SeasonRatingWithUser[]
}

export interface UpsertSeasonRatingInput {
  userId: string
  showId: number
  showName: string
  showPosterPath: string | null
  seasonNumber: number
  seasonName: string | null
  rating: number
}

export async function upsertSeasonRating(input: UpsertSeasonRatingInput): Promise<SeasonRating> {
  const { data, error } = await supabase
    .from('season_ratings')
    .upsert(
      {
        user_id: input.userId,
        show_id: input.showId,
        show_name: input.showName,
        show_poster_path: input.showPosterPath,
        season_number: input.seasonNumber,
        season_name: input.seasonName,
        rating: input.rating,
        rated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,show_id,season_number' },
    )
    .select()
    .single()

  if (error) throw error
  return data as SeasonRating
}

export async function deleteSeasonRating(
  userId: string,
  showId: number,
  seasonNumber: number,
): Promise<void> {
  const { error } = await supabase
    .from('season_ratings')
    .delete()
    .eq('user_id', userId)
    .eq('show_id', showId)
    .eq('season_number', seasonNumber)

  if (error) throw error
}
