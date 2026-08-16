import { supabase } from './supabase'
import type { ShowStarted } from '../types'

/** All shows one user has explicitly started (0/x or otherwise) -- merged
 * into Now Watching by summarizeShowActivity, alongside real episode_watched
 * progress. */
export async function fetchStartedForUser(userId: string): Promise<ShowStarted[]> {
  const { data, error } = await supabase.from('show_started').select('*').eq('user_id', userId)

  if (error) throw error
  return (data ?? []) as ShowStarted[]
}

/** One user's started status for a single show, or null if they haven't
 * declared they're starting it. */
export async function fetchStartedItem(userId: string, showId: number): Promise<ShowStarted | null> {
  const { data, error } = await supabase
    .from('show_started')
    .select('*')
    .eq('user_id', userId)
    .eq('show_id', showId)
    .maybeSingle()

  if (error) throw error
  return (data as ShowStarted) ?? null
}

export interface StartShowInput {
  userId: string
  showId: number
  showName: string
  showPosterPath: string | null
  showTotalEpisodes: number | null
}

/** "Start watching" -- records the declaration without touching
 * episode_watched, so Now Watching can show 0/x instead of faking progress
 * by marking episode 1. */
export async function startShow(input: StartShowInput): Promise<ShowStarted> {
  const { data, error } = await supabase
    .from('show_started')
    .upsert(
      {
        user_id: input.userId,
        show_id: input.showId,
        show_name: input.showName,
        show_poster_path: input.showPosterPath,
        show_total_episodes: input.showTotalEpisodes,
        started_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,show_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data as ShowStarted
}
