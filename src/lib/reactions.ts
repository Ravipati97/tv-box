import { supabase } from './supabase'
import type { ReactionMap, RatingReaction } from '../types'

export function groupReactionsByRating(rows: RatingReaction[]): ReactionMap {
  const map: ReactionMap = {}
  for (const row of rows) {
    if (!map[row.rating_id]) map[row.rating_id] = []
    map[row.rating_id].push(row)
  }
  return map
}

export async function fetchReactionsForRatings(ratingIds: string[]): Promise<RatingReaction[]> {
  if (ratingIds.length === 0) return []
  const { data, error } = await supabase
    .from('rating_reactions')
    .select('*')
    .in('rating_id', ratingIds)

  if (error) throw error
  return (data ?? []) as RatingReaction[]
}

/**
 * Sets `emoji` as the user's reaction to a rating. If they already reacted
 * with that same emoji, it's removed instead (toggle off). Returns the new
 * reaction row, or null if the reaction was removed.
 */
export async function toggleReaction(
  ratingId: string,
  userId: string,
  emoji: string,
): Promise<RatingReaction | null> {
  const { data: existing, error: fetchError } = await supabase
    .from('rating_reactions')
    .select('*')
    .eq('rating_id', ratingId)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError) throw fetchError

  if (existing && (existing as RatingReaction).emoji === emoji) {
    const { error } = await supabase
      .from('rating_reactions')
      .delete()
      .eq('rating_id', ratingId)
      .eq('user_id', userId)
    if (error) throw error
    return null
  }

  const { data, error } = await supabase
    .from('rating_reactions')
    .upsert(
      { rating_id: ratingId, user_id: userId, emoji },
      { onConflict: 'rating_id,user_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data as RatingReaction
}
