import { supabase } from './supabase'
import type { ShowWatchingDismissed } from '../types'

/** All shows one user has hidden from Now Watching -- merged into
 * summarizeShowActivity/nowWatching by Home.tsx, alongside real progress and
 * show_started rows. */
export async function fetchDismissedForUser(userId: string): Promise<ShowWatchingDismissed[]> {
  const { data, error } = await supabase.from('show_watching_dismissed').select('*').eq('user_id', userId)

  if (error) throw error
  return (data ?? []) as ShowWatchingDismissed[]
}

/** One user's dismissed status for a single show, or null if it's currently
 * showing in Now Watching (or was never in it). Powers the toggle on the
 * show's own page -- see ShowDetail.tsx. */
export async function fetchDismissedItem(userId: string, showId: number): Promise<ShowWatchingDismissed | null> {
  const { data, error } = await supabase
    .from('show_watching_dismissed')
    .select('*')
    .eq('user_id', userId)
    .eq('show_id', showId)
    .maybeSingle()

  if (error) throw error
  return (data as ShowWatchingDismissed) ?? null
}

/** "Remove from Now Watching" -- hides the show without touching
 * show_started or episode_watched. Upsert (not insert) since re-dismissing
 * an already-dismissed show should just no-op cleanly. */
export async function dismissShow(userId: string, showId: number): Promise<ShowWatchingDismissed> {
  const { data, error } = await supabase
    .from('show_watching_dismissed')
    .upsert(
      { user_id: userId, show_id: showId, dismissed_at: new Date().toISOString() },
      { onConflict: 'user_id,show_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data as ShowWatchingDismissed
}

/** Un-hides a show -- used both for the Undo action right after dismissing,
 * and as a best-effort side effect whenever the user resumes a dismissed
 * show (marks an episode watched, or taps "Start watching" again). Plain
 * delete, not "delete if exists" -- Postgres deletes are already no-ops when
 * nothing matches. */
export async function undismissShow(userId: string, showId: number): Promise<void> {
  const { error } = await supabase
    .from('show_watching_dismissed')
    .delete()
    .eq('user_id', userId)
    .eq('show_id', showId)

  if (error) throw error
}
