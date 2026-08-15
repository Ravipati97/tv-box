import { getShowDetail } from './tmdb'
import type { TmdbSeasonSummary } from '../types'

/** One season's watched/total, in order -- the building block for a
 * per-season progress readout instead of one flat show-wide fraction. */
export interface SeasonSegment {
  seasonNumber: number
  watched: number
  total: number
}

export interface SeasonProgress {
  segments: SeasonSegment[]
  currentSeasonNumber: number
  currentSeasonWatched: number
  currentSeasonTotal: number
}

/**
 * Turns "10/44 watched" into something that actually tells you where you
 * are: which season you're mid-way through, and that the ones before it
 * are done. "Current" is the first not-fully-watched real season -- if
 * every real season is somehow fully watched (stale TMDB episode counts,
 * usually), falls back to the last one rather than showing nothing.
 */
export function computeSeasonProgress(
  seasons: TmdbSeasonSummary[],
  watchedBySeason: Record<number, number>,
): SeasonProgress | null {
  const real = seasons
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number)
  if (real.length === 0) return null

  const segments: SeasonSegment[] = real.map((s) => ({
    seasonNumber: s.season_number,
    watched: Math.min(watchedBySeason[s.season_number] ?? 0, s.episode_count),
    total: s.episode_count,
  }))

  const current = segments.find((s) => s.watched < s.total) ?? segments[segments.length - 1]

  return {
    segments,
    currentSeasonNumber: current.seasonNumber,
    currentSeasonWatched: current.watched,
    currentSeasonTotal: current.total,
  }
}

// Module-level cache: a show's season/episode-count breakdown never changes
// within a session, and the same in-progress shows reappear every time Home
// loads -- no reason to refetch on every visit.
const seasonCache = new Map<number, TmdbSeasonSummary[]>()

/** Batched + cached per-show season breakdowns, for computing season
 * progress across everything in "Now Watching" at once. */
export async function fetchSeasonBreakdowns(showIds: number[]): Promise<Map<number, TmdbSeasonSummary[]>> {
  const uncached = [...new Set(showIds)].filter((id) => !seasonCache.has(id))

  await Promise.all(
    uncached.map(async (id) => {
      try {
        const detail = await getShowDetail(id)
        seasonCache.set(id, detail.seasons)
      } catch {
        // Season breakdown is a nice-to-have -- callers fall back to the
        // flat total when a show is missing from the returned map.
      }
    }),
  )

  const result = new Map<number, TmdbSeasonSummary[]>()
  for (const id of showIds) {
    const seasons = seasonCache.get(id)
    if (seasons) result.set(id, seasons)
  }
  return result
}
