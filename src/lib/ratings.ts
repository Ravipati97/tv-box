import { supabase } from './supabase'
import type { EpisodeRating, RatingMap } from '../types'

export function ratingKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}-${episodeNumber}`
}

export async function fetchRatingsForShow(userId: string, showId: number): Promise<RatingMap> {
  const { data, error } = await supabase
    .from('episode_ratings')
    .select('*')
    .eq('user_id', userId)
    .eq('show_id', showId)

  if (error) throw error

  const map: RatingMap = {}
  for (const row of (data ?? []) as EpisodeRating[]) {
    map[ratingKey(row.season_number, row.episode_number)] = row
  }
  return map
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
