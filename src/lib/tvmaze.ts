/**
 * TMDB's episode air_date sometimes reflects an early-access drop time
 * rather than a show's officially marketed release day -- e.g. Apple TV+
 * titles that post the next episode the evening before its Wednesday release
 * (TMDB records that Tuesday timestamp). TVmaze is purpose-built for
 * broadcast scheduling and tracks the TV-guide release day instead, so it's
 * used here as a correction layer over specific episodes: TMDB stays the
 * backbone for everything else in the app (show/episode IDs, posters, cast,
 * overviews, watch providers), and only the *displayed* air date gets
 * overlaid with TVmaze's when a confident match exists.
 *
 * Matched via IMDb ID (TMDB's external_ids, TVmaze's /lookup/shows?imdb=) --
 * more reliable than matching by name, which risks pairing the wrong show
 * for common titles or reboots. Every lookup fails silently and falls back
 * to TMDB's own air_date: TVmaze's catalog is smaller than TMDB's (weaker on
 * reality TV, anime, and very niche/international titles), so "not found"
 * is an expected, normal outcome, not an error.
 */

const TVMAZE_BASE = 'https://api.tvmaze.com'

async function tvmazeFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${TVMAZE_BASE}${path}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`TVmaze request failed (${res.status}) for ${path}`)
  return res.json() as Promise<T>
}

interface TvmazeShow {
  id: number
}

interface TvmazeEpisode {
  season: number
  number: number
  /** Empty string (not null) when TVmaze doesn't have a date for this episode yet. */
  airdate: string
}

export function tvmazeEpisodeKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}-${episodeNumber}`
}

// Module-level caches, same pattern as the rest of lib/ -- this data doesn't
// change within a session. Keyed by IMDb ID (TVmaze's own natural key here)
// rather than TMDB show ID, since that's what both lookups actually need.
const showIdByImdbId = new Map<string, number | null>()
const airDatesByTvmazeShowId = new Map<number, Map<string, string>>()

async function findTvmazeShowId(imdbId: string): Promise<number | null> {
  const cached = showIdByImdbId.get(imdbId)
  if (cached !== undefined) return cached
  let result: number | null = null
  try {
    const show = await tvmazeFetch<TvmazeShow>(`/lookup/shows?imdb=${encodeURIComponent(imdbId)}`)
    result = show?.id ?? null
  } catch {
    result = null
  }
  showIdByImdbId.set(imdbId, result)
  return result
}

async function fetchTvmazeAirDates(tvmazeShowId: number): Promise<Map<string, string>> {
  const cached = airDatesByTvmazeShowId.get(tvmazeShowId)
  if (cached) return cached
  const map = new Map<string, string>()
  try {
    const episodes = await tvmazeFetch<TvmazeEpisode[]>(`/shows/${tvmazeShowId}/episodes`)
    for (const ep of episodes ?? []) {
      if (ep.airdate) map.set(tvmazeEpisodeKey(ep.season, ep.number), ep.airdate)
    }
  } catch {
    // Leave the map empty -- callers fall back to TMDB's own air_date per episode.
  }
  airDatesByTvmazeShowId.set(tvmazeShowId, map)
  return map
}

/**
 * Corrected air dates for one show, keyed by tvmazeEpisodeKey(season, episode)
 * -- empty map (not an error) when there's no IMDb ID, no TVmaze match, or
 * the lookup fails for any reason. Callers should treat a missing entry the
 * same way: `corrected.get(key) ?? episode.air_date`.
 */
export async function getCorrectedAirDates(imdbId: string | null | undefined): Promise<Map<string, string>> {
  if (!imdbId) return new Map()
  const tvmazeShowId = await findTvmazeShowId(imdbId)
  if (tvmazeShowId === null) return new Map()
  return fetchTvmazeAirDates(tvmazeShowId)
}
