import { supabase } from './supabase'
import type { StreamingOverride } from '../types'

/** The group's manually-corrected "where to watch" answer for a show, if anyone has set one. */
export async function fetchStreamingOverride(showId: number): Promise<StreamingOverride | null> {
  const { data, error } = await supabase
    .from('show_streaming_overrides')
    .select('*')
    .eq('show_id', showId)
    .maybeSingle()

  if (error) throw error
  return (data as StreamingOverride) ?? null
}

export interface SetStreamingOverrideInput {
  showId: number
  providerId: number | null
  providerName: string
  providerLogoPath: string | null
  updatedBy: string
}

export async function setStreamingOverride(input: SetStreamingOverrideInput): Promise<StreamingOverride> {
  const { data, error } = await supabase
    .from('show_streaming_overrides')
    .upsert(
      {
        show_id: input.showId,
        provider_id: input.providerId,
        provider_name: input.providerName,
        provider_logo_path: input.providerLogoPath,
        updated_by: input.updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'show_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data as StreamingOverride
}

export async function clearStreamingOverride(showId: number): Promise<void> {
  const { error } = await supabase.from('show_streaming_overrides').delete().eq('show_id', showId)
  if (error) throw error
}
