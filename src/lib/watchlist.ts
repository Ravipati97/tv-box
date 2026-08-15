import { supabase } from './supabase'
import type { WatchlistItem } from '../types'

export async function fetchWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as WatchlistItem[]
}

/** One user's watchlist status for a single show, or null if it's not on there. */
export async function fetchWatchlistItem(userId: string, showId: number): Promise<WatchlistItem | null> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .eq('show_id', showId)
    .maybeSingle()

  if (error) throw error
  return (data as WatchlistItem) ?? null
}

export interface AddToWatchlistInput {
  userId: string
  showId: number
  showName: string
  showPosterPath: string | null
}

export async function addToWatchlist(input: AddToWatchlistInput): Promise<WatchlistItem> {
  const { data, error } = await supabase
    .from('watchlist')
    .upsert(
      {
        user_id: input.userId,
        show_id: input.showId,
        show_name: input.showName,
        show_poster_path: input.showPosterPath,
        added_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,show_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data as WatchlistItem
}

export async function removeFromWatchlist(userId: string, showId: number): Promise<void> {
  const { error } = await supabase.from('watchlist').delete().eq('user_id', userId).eq('show_id', showId)
  if (error) throw error
}
