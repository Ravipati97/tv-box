import { getWatchProviders } from './tmdb'
import { fetchStreamingOverride } from './streamingOverrides'
import type { TmdbWatchProvider, TmdbWatchProviderRegion } from '../types'

/** Providers can repeat across flatrate/rent/buy -- keep one, sorted the way TMDB ranks them. */
export function dedupeProviders(list: TmdbWatchProvider[]): TmdbWatchProvider[] {
  const seen = new Set<number>()
  return list
    .filter((p) => {
      if (seen.has(p.provider_id)) return false
      seen.add(p.provider_id)
      return true
    })
    .sort((a, b) => a.display_priority - b.display_priority)
}

/** The single best-guess "free to you" provider for a region -- included with a
 * subscription first, then genuinely free/ad-supported. Deliberately never
 * rent/buy: those cost extra, so they're not "free" by any reading. */
export function pickBestFreeProvider(region: TmdbWatchProviderRegion | null): TmdbWatchProvider | null {
  if (!region) return null
  const flatrate = dedupeProviders(region.flatrate ?? [])
  if (flatrate.length > 0) return flatrate[0]
  const free = dedupeProviders([...(region.free ?? []), ...(region.ads ?? [])])
  return free[0] ?? null
}

export interface ResolvedProvider {
  provider_name: string
  logo_path: string | null
}

/** The group's resolved "where to watch" answer for one show: a manual
 * override always wins, otherwise the best automatic free guess. */
export async function resolveShowPlatform(showId: number, region: string): Promise<ResolvedProvider | null> {
  const [providers, override] = await Promise.all([
    getWatchProviders(showId).catch(() => null),
    fetchStreamingOverride(showId).catch(() => null),
  ])
  if (override) return { provider_name: override.provider_name, logo_path: override.provider_logo_path }
  const best = pickBestFreeProvider(providers?.results[region] ?? null)
  return best ? { provider_name: best.provider_name, logo_path: best.logo_path } : null
}

// Module-level cache: platform data doesn't change within a session, and the
// same shows tend to reappear across Home/Profile/Activity -- no reason to
// refetch every time someone switches to the "Platform" sort.
const platformCache = new Map<string, ResolvedProvider | null>()

function cacheKey(showId: number, region: string): string {
  return `${region}:${showId}`
}

/** Resolves "where to watch" for many shows at once (batched + cached), for
 * grouping a history/activity list by streaming platform. */
export async function resolveShowPlatforms(
  showIds: number[],
  region: string,
): Promise<Map<number, ResolvedProvider | null>> {
  const uncached = [...new Set(showIds)].filter((id) => !platformCache.has(cacheKey(id, region)))

  await Promise.all(
    uncached.map(async (id) => {
      const result = await resolveShowPlatform(id, region).catch(() => null)
      platformCache.set(cacheKey(id, region), result)
    }),
  )

  const result = new Map<number, ResolvedProvider | null>()
  for (const id of showIds) {
    result.set(id, platformCache.get(cacheKey(id, region)) ?? null)
  }
  return result
}
