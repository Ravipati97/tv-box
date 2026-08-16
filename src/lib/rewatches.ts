import { supabase } from './supabase'
import type { ShowRewatch } from '../types'

export async function fetchRewatchesForShow(userId: string, showId: number): Promise<ShowRewatch[]> {
  const { data, error } = await supabase
    .from('show_rewatches')
    .select('*')
    .eq('user_id', userId)
    .eq('show_id', showId)
    .order('rewatched_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ShowRewatch[]
}

export async function fetchRecentRewatches(userId: string, limit = 2000): Promise<ShowRewatch[]> {
  const { data, error } = await supabase
    .from('show_rewatches')
    .select('*')
    .eq('user_id', userId)
    .order('rewatched_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as ShowRewatch[]
}

export interface LogRewatchInput {
  userId: string
  showId: number
  showName: string
  showPosterPath: string | null
}

/** Logs one rewatch event. Unlike everything else in this app, this is a
 * plain insert, not an upsert -- there's no unique constraint to conflict
 * with, since logging the same show's rewatch twice is the whole point. */
export async function logRewatch(input: LogRewatchInput): Promise<ShowRewatch> {
  const { data, error } = await supabase
    .from('show_rewatches')
    .insert({
      user_id: input.userId,
      show_id: input.showId,
      show_name: input.showName,
      show_poster_path: input.showPosterPath,
      rewatched_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as ShowRewatch
}

export async function deleteRewatch(id: string): Promise<void> {
  const { error } = await supabase.from('show_rewatches').delete().eq('id', id)
  if (error) throw error
}

/** Re-inserts a deleted rewatch, preserving its original rewatched_at (not
 * "now") -- used to undo deleteRewatch. There's no unique constraint on this
 * table to upsert against (repeat rewatches are the whole point), so this is
 * a plain insert and the restored row gets a new id -- fine, since nothing
 * in the UI keys off a rewatch's id beyond React's list key. */
export async function restoreRewatch(row: ShowRewatch): Promise<ShowRewatch> {
  const { data, error } = await supabase
    .from('show_rewatches')
    .insert({
      user_id: row.user_id,
      show_id: row.show_id,
      show_name: row.show_name,
      show_poster_path: row.show_poster_path,
      rewatched_at: row.rewatched_at,
    })
    .select()
    .single()

  if (error) throw error
  return data as ShowRewatch
}
