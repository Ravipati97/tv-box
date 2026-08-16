import type {
  TmdbProviderListItem,
  TmdbSeasonDetail,
  TmdbShowDetail,
  TmdbShowSummary,
  TmdbWatchProviders,
} from '../types'

const API_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const API_KEY = import.meta.env.VITE_TMDB_API_KEY

export const isTmdbConfigured = Boolean(API_KEY)

class TmdbError extends Error {}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) {
    throw new TmdbError(
      'TMDB is not configured. Set VITE_TMDB_API_KEY in .env.local (see .env.example).',
    )
  }
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('language', 'en-US')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new TmdbError(`TMDB request failed (${res.status}) for ${path}`)
  }
  return res.json() as Promise<T>
}

export async function searchShows(query: string): Promise<TmdbShowSummary[]> {
  if (!query.trim()) return []
  const data = await tmdbFetch<{ results: TmdbShowSummary[] }>('/search/tv', {
    query,
    include_adult: 'false',
    page: '1',
  })
  // Only keep shows with at least a name + poster-ish signal, ranked by TMDB's own relevance.
  return data.results
}

// Module-level cache: a show's detail (name, seasons, external IDs) never
// changes within a session, and this ends up fetched twice for the same
// show on ShowDetail -- once for the page itself, once by lib/tvmaze.ts to
// look up the show's IMDb ID for its air-date correction. Same pattern as
// the other session caches in this codebase (seasonCache, platformCache).
const showDetailCache = new Map<number, TmdbShowDetail>()

export async function getShowDetail(showId: number): Promise<TmdbShowDetail> {
  const cached = showDetailCache.get(showId)
  if (cached) return cached
  // external_ids (IMDb, TheTVDB, ...) piggybacks on this same request rather
  // than a separate call -- it's what lets lib/tvmaze.ts cross-reference a
  // show without a second round trip per page load.
  const detail = await tmdbFetch<TmdbShowDetail>(`/tv/${showId}`, { append_to_response: 'external_ids' })
  showDetailCache.set(showId, detail)
  return detail
}

export async function getSeasonDetail(
  showId: number,
  seasonNumber: number,
): Promise<TmdbSeasonDetail> {
  return tmdbFetch<TmdbSeasonDetail>(`/tv/${showId}/season/${seasonNumber}`)
}

/** Streaming/rent/buy availability by country, sourced from JustWatch via TMDB. */
export async function getWatchProviders(showId: number): Promise<TmdbWatchProviders> {
  return tmdbFetch<TmdbWatchProviders>(`/tv/${showId}/watch/providers`)
}

/** Every streaming provider TMDB knows about for a region -- powers the manual "fix it" picker. */
export async function getAllTvProviders(region: string): Promise<TmdbProviderListItem[]> {
  const data = await tmdbFetch<{ results: TmdbProviderListItem[] }>('/watch/providers/tv', {
    watch_region: region,
  })
  return (data.results ?? []).slice().sort((a, b) => {
    const ap = a.display_priorities[region] ?? a.display_priority
    const bp = b.display_priorities[region] ?? b.display_priority
    return ap - bp
  })
}

/** Best-guess 2-letter region from the browser's own locale, falling back to US. */
export function detectRegion(): string {
  try {
    const locale = navigator.language || 'en-US'
    const region = locale.split('-')[1]?.toUpperCase()
    return region && region.length === 2 ? region : 'US'
  } catch {
    return 'US'
  }
}

type ImageSize =
  | 'w92'
  | 'w154'
  | 'w185'
  | 'w300'
  | 'w342'
  | 'w500'
  | 'w780'
  | 'w1280'
  | 'original'

export function posterUrl(path: string | null, size: ImageSize = 'w342'): string | null {
  if (!path) return null
  return `${IMAGE_BASE}/${size}${path}`
}

export function backdropUrl(path: string | null, size: ImageSize = 'w1280'): string | null {
  if (!path) return null
  return `${IMAGE_BASE}/${size}${path}`
}

export function stillUrl(path: string | null, size: ImageSize = 'w300'): string | null {
  if (!path) return null
  return `${IMAGE_BASE}/${size}${path}`
}

export function providerLogoUrl(path: string | null, size: ImageSize = 'w92'): string | null {
  if (!path) return null
  return `${IMAGE_BASE}/${size}${path}`
}

export function yearFromDate(date: string | null): string {
  if (!date) return ''
  const year = date.slice(0, 4)
  return year || ''
}
