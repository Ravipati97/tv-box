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

/** Matches JustWatch/TMDB's "resold through someone else's storefront" listings
 * -- e.g. "HBO Max Amazon Channel", "Starz Apple TV Channel", "Crave Amazon
 * Channel". These are the *same* underlying service as their plain-name
 * counterpart (just billed through Amazon/Apple TV/Roku's add-on channel
 * system instead of directly), but JustWatch's own display_priority often
 * ranks the reseller listing *ahead* of the direct one -- e.g. for Friends
 * in the US, "HBO Max Amazon Channel" (priority 11) outranks plain "HBO Max"
 * (priority 152), plus the reseller entry carries its own, different logo
 * asset. Picking flatrate[0] blindly then surfaces an unfamiliar name and a
 * mismatched icon for a show that's plainly "just on HBO Max". Deliberately
 * excludes "The Roku Channel" (a real standalone free service, not a resold
 * add-on) -- only "<Base> Roku Premium Channel" matches. Some real TMDB
 * entries have stray trailing whitespace or inconsistent capitalization
 * ("ALLBLK Amazon channel ", "BBC Select Apple Tv channel") -- callers must
 * trim before testing; the `i` flag alone covers the casing. */
const RESELLER_CHANNEL_SUFFIX = /\s(Amazon|Apple TV|Roku Premium|Prime Video|Google Play)\s*Channel$/i

/** Live-TV / cable-replacement bundles (YouTube TV, fuboTV, Sling, Philo,
 * DirecTV Stream, Hulu + Live TV). JustWatch lists these as "flatrate" when
 * a show also airs as reruns on a cable network the bundle carries (e.g.
 * Friends via TBS, inside YouTube TV's channel lineup), and sometimes ranks
 * them above the show's actual streaming home. A $70-90/mo live-TV bundle
 * is a different value proposition than "you already have this app" though,
 * so it's deprioritized the same way as reseller channels. */
const LIVE_TV_BUNDLE = /^(YouTube ?TV|fubo ?TV|Sling ?TV|Philo|DirecTV( Stream)?|Hulu\s*\+?\s*Live ?TV|Vidgo|Frndly ?TV)\b/i

function isLowSignalProvider(providerName: string): boolean {
  const name = providerName.trim()
  return RESELLER_CHANNEL_SUFFIX.test(name) || LIVE_TV_BUNDLE.test(name)
}

/** The first provider in priority order that isn't a reseller-channel or
 * live-TV-bundle listing, falling back to the top overall listing if
 * that's genuinely the only way to watch (some smaller platforms are only
 * ever offered bundled, with no direct/standalone option anywhere). */
function pickDirect(list: TmdbWatchProvider[]): TmdbWatchProvider | null {
  if (list.length === 0) return null
  return list.find((p) => !isLowSignalProvider(p.provider_name)) ?? list[0]
}

/** The single best-guess "free to you" provider for a region -- included with a
 * subscription first, then genuinely free/ad-supported. Deliberately never
 * rent/buy: those cost extra, so they're not "free" by any reading. */
export function pickBestFreeProvider(region: TmdbWatchProviderRegion | null): TmdbWatchProvider | null {
  if (!region) return null
  const flatrate = dedupeProviders(region.flatrate ?? [])
  const direct = pickDirect(flatrate)
  if (direct) return direct
  const free = dedupeProviders([...(region.free ?? []), ...(region.ads ?? [])])
  return pickDirect(free)
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

/**
 * Drops every cached answer for a show (all regions -- cheap, and simpler
 * than threading the current region in here). Call this after setting or
 * clearing a streaming override: the cache above is what every poster badge
 * (Home, History, Search) reads from, and it has no other way to learn a
 * manual correction just happened. Without this, the badge shows the old
 * answer until a full page reload starts a fresh module instance.
 */
export function invalidatePlatformCache(showId: number): void {
  for (const key of platformCache.keys()) {
    if (key.endsWith(`:${showId}`)) platformCache.delete(key)
  }
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
