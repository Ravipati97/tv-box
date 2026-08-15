import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SeasonTabs from '../components/SeasonTabs'
import EpisodeRow from '../components/EpisodeRow'
import StarRating from '../components/StarRating'
import { EpisodeRowSkeleton } from '../components/Skeletons'
import {
  backdropUrl,
  detectRegion,
  getAllTvProviders,
  getSeasonDetail,
  getShowDetail,
  getWatchProviders,
  posterUrl,
  providerLogoUrl,
  yearFromDate,
} from '../lib/tmdb'
import { fetchAllShowRatings, upsertShowRating, deleteShowRating } from '../lib/showRatings'
import {
  bulkMarkWatched,
  fetchWatchedForShow,
  markWatched,
  UNKNOWN_WATCHED_AT,
  unmarkWatched,
  watchedKey,
} from '../lib/watched'
import { clearStreamingOverride, fetchStreamingOverride, setStreamingOverride } from '../lib/streamingOverrides'
import { useAuth } from '../contexts/AuthContext'
import type {
  ShowRatingWithUser,
  StreamingOverride,
  TmdbProviderListItem,
  TmdbSeasonDetail,
  TmdbShowDetail,
  TmdbWatchProvider,
  TmdbWatchProviders,
  WatchedMap,
} from '../types'

/** Providers can repeat across flatrate/rent/buy -- keep one, sorted the way TMDB ranks them. */
function dedupeProviders(list: TmdbWatchProvider[]): TmdbWatchProvider[] {
  const seen = new Set<number>()
  return list
    .filter((p) => {
      if (seen.has(p.provider_id)) return false
      seen.add(p.provider_id)
      return true
    })
    .sort((a, b) => a.display_priority - b.display_priority)
}

export default function ShowDetail() {
  const { id } = useParams<{ id: string }>()
  const showId = Number(id)
  const { user } = useAuth()

  const [show, setShow] = useState<TmdbShowDetail | null>(null)
  const [season, setSeason] = useState<TmdbSeasonDetail | null>(null)
  const [activeSeason, setActiveSeason] = useState<number | null>(null)
  const [watched, setWatched] = useState<WatchedMap>({})
  const [showRatings, setShowRatings] = useState<ShowRatingWithUser[]>([])
  const [loadingShow, setLoadingShow] = useState(true)
  const [loadingSeason, setLoadingSeason] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingRating, setSavingRating] = useState(false)
  const [showRatersList, setShowRatersList] = useState(false)
  const [providers, setProviders] = useState<TmdbWatchProviders | null>(null)
  const [override, setOverride] = useState<StreamingOverride | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Load show detail + my watch progress + everyone's show rating, in parallel.
  useEffect(() => {
    let cancelled = false
    setLoadingShow(true)
    setError(null)

    async function load() {
      try {
        const [showData, watchedMap, ratings] = await Promise.all([
          getShowDetail(showId),
          user ? fetchWatchedForShow(user.id, showId) : Promise.resolve({}),
          fetchAllShowRatings(showId),
        ])
        if (cancelled) return
        setShow(showData)
        setWatched(watchedMap)
        setShowRatings(ratings)
        const firstRealSeason = showData.seasons.find((s) => s.season_number > 0) ?? showData.seasons[0]
        setActiveSeason(firstRealSeason ? firstRealSeason.season_number : null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load show.')
      } finally {
        if (!cancelled) setLoadingShow(false)
      }
    }

    if (!Number.isNaN(showId)) load()
    return () => {
      cancelled = true
    }
  }, [showId, user])

  // Load episodes whenever the active season changes.
  useEffect(() => {
    if (activeSeason === null) return
    let cancelled = false
    setLoadingSeason(true)

    getSeasonDetail(showId, activeSeason)
      .then((data) => {
        if (!cancelled) setSeason(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load season.')
      })
      .finally(() => {
        if (!cancelled) setLoadingSeason(false)
      })

    return () => {
      cancelled = true
    }
  }, [showId, activeSeason])

  // Where-to-watch is a nice-to-have -- fetch it separately so a hiccup on
  // either of these endpoints never blocks or errors out the rest of the page.
  useEffect(() => {
    if (Number.isNaN(showId)) return
    let cancelled = false
    getWatchProviders(showId)
      .then((data) => {
        if (!cancelled) setProviders(data)
      })
      .catch(() => {
        // Silently skip the section rather than surfacing an error for this.
      })
    fetchStreamingOverride(showId)
      .then((data) => {
        if (!cancelled) setOverride(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [showId])

  const region = useMemo(() => detectRegion(), [])
  const regionProviders = providers?.results[region] ?? null

  // The single best-guess "free to you" answer -- included with a
  // subscription first, then genuinely free/ad-supported. Deliberately never
  // rent/buy here: those cost extra, so they're not "free" by any reading.
  const bestFreeProvider = useMemo(() => {
    if (!regionProviders) return null
    const flatrate = dedupeProviders(regionProviders.flatrate ?? [])
    if (flatrate.length > 0) return flatrate[0]
    const free = dedupeProviders([...(regionProviders.free ?? []), ...(regionProviders.ads ?? [])])
    return free[0] ?? null
  }, [regionProviders])

  // A manual correction always wins over the automatic guess.
  const effectiveProvider: { provider_name: string; logo_path: string | null } | null = override
    ? { provider_name: override.provider_name, logo_path: override.provider_logo_path }
    : bestFreeProvider

  const watchedCount = Object.keys(watched).length
  const totalEpisodes = show?.number_of_episodes ?? null

  const seasonWatchedCount = useMemo(() => {
    if (!season) return null
    return season.episodes.filter((ep) => watched[watchedKey(ep.season_number, ep.episode_number)]).length
  }, [season, watched])

  const myShowRating = useMemo(
    () => showRatings.find((r) => r.user_id === user?.id) ?? null,
    [showRatings, user],
  )
  const others = useMemo(
    () => showRatings.filter((r) => r.user_id !== user?.id),
    [showRatings, user],
  )
  const othersAvg =
    others.length > 0 ? others.reduce((sum, r) => sum + r.rating, 0) / others.length : null

  async function handleToggleWatched(episodeNumber: number, episodeName: string) {
    if (!user || !show || activeSeason === null) return
    const key = watchedKey(activeSeason, episodeNumber)

    if (watched[key]) {
      setWatched((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      await unmarkWatched(user.id, show.id, activeSeason, episodeNumber)
      return
    }

    const saved = await markWatched({
      userId: user.id,
      showId: show.id,
      showName: show.name,
      showPosterPath: show.poster_path,
      showTotalEpisodes: show.number_of_episodes,
      seasonNumber: activeSeason,
      episodeNumber,
      episodeName,
    })
    setWatched((prev) => ({ ...prev, [key]: saved }))
  }

  async function handleMarkAllWatched(input: { watchedAt: string; unknownDate: boolean }) {
    if (!user || !show) return
    const episodes = show.seasons
      .filter((s) => s.season_number > 0)
      .flatMap((s) =>
        Array.from({ length: s.episode_count }, (_, i) => ({
          seasonNumber: s.season_number,
          episodeNumber: i + 1,
        })),
      )
    const saved = await bulkMarkWatched({
      userId: user.id,
      showId: show.id,
      showName: show.name,
      showPosterPath: show.poster_path,
      showTotalEpisodes: show.number_of_episodes,
      episodes,
      watchedAt: input.watchedAt,
      watchedAtUnknown: input.unknownDate,
    })
    setWatched((prev) => {
      const next = { ...prev }
      for (const row of saved) next[watchedKey(row.season_number, row.episode_number)] = row
      return next
    })
  }

  async function handleMarkSeasonWatched(input: { watchedAt: string; unknownDate: boolean }) {
    if (!user || !show || !season) return
    const episodes = season.episodes.map((ep) => ({
      seasonNumber: ep.season_number,
      episodeNumber: ep.episode_number,
      episodeName: ep.name,
    }))
    const saved = await bulkMarkWatched({
      userId: user.id,
      showId: show.id,
      showName: show.name,
      showPosterPath: show.poster_path,
      showTotalEpisodes: show.number_of_episodes,
      episodes,
      watchedAt: input.watchedAt,
      watchedAtUnknown: input.unknownDate,
    })
    setWatched((prev) => {
      const next = { ...prev }
      for (const row of saved) next[watchedKey(row.season_number, row.episode_number)] = row
      return next
    })
  }

  async function handlePickProvider(p: TmdbProviderListItem) {
    if (!user || !show) return
    const saved = await setStreamingOverride({
      showId: show.id,
      providerId: p.provider_id,
      providerName: p.provider_name,
      providerLogoPath: p.logo_path,
      updatedBy: user.id,
    })
    setOverride(saved)
    setPickerOpen(false)
  }

  async function handleClearOverride() {
    if (!show) return
    await clearStreamingOverride(show.id)
    setOverride(null)
  }

  async function handleRateShow(value: number) {
    if (!user || !show) return
    setSavingRating(true)
    try {
      if (value === 0) {
        setShowRatings((prev) => prev.filter((r) => r.user_id !== user.id))
        await deleteShowRating(user.id, show.id)
        return
      }
      const saved = await upsertShowRating({
        userId: user.id,
        showId: show.id,
        showName: show.name,
        showPosterPath: show.poster_path,
        rating: value,
      })
      setShowRatings((prev) => [
        ...prev.filter((r) => r.user_id !== user.id),
        { ...saved, users: { username: user.username } },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rating.')
    } finally {
      setSavingRating(false)
    }
  }

  if (Number.isNaN(showId)) {
    return <p className="p-8 text-center text-sm text-red-400">Invalid show.</p>
  }

  if (error && !show) {
    return <p className="p-8 text-center text-sm text-red-400">{error}</p>
  }

  return (
    <div className="pb-24 md:pb-10">
      {/* Hero */}
      <div className="relative h-56 w-full overflow-hidden sm:h-auto sm:aspect-[3/1] sm:max-h-[520px]">
        {show?.backdrop_path ? (
          <img
            src={backdropUrl(show.backdrop_path) ?? undefined}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-base-850" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base-950 via-base-950/70 to-base-950/20" />
      </div>

      <div className="mx-auto -mt-20 max-w-5xl px-4 sm:-mt-24 sm:px-6">
        <div className="flex gap-4 sm:gap-6">
          <div className="aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl bg-base-800 shadow-2xl shadow-black/50 ring-1 ring-white/10 sm:w-40">
            {show?.poster_path && (
              <img
                src={posterUrl(show.poster_path) ?? undefined}
                alt={show.name}
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="min-w-0 flex-1 self-end pb-1"
          >
            {loadingShow ? (
              <div className="animate-pulse space-y-2">
                <div className="h-6 w-2/3 rounded bg-base-800" />
                <div className="h-3 w-1/3 rounded bg-base-800" />
              </div>
            ) : (
              show && (
                <>
                  <h1 className="font-display text-xl font-semibold text-base-100 sm:text-3xl">
                    {show.name}
                  </h1>
                  <p className="mt-1 text-xs text-base-400 sm:text-sm">
                    {yearFromDate(show.first_air_date)} · {show.number_of_seasons} season
                    {show.number_of_seasons === 1 ? '' : 's'} · {show.status}
                  </p>
                </>
              )
            )}
          </motion.div>
        </div>

        {/* Your rating + the crowd's */}
        {show && !loadingShow && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <StarRating value={myShowRating?.rating ?? 0} onChange={handleRateShow} size="lg" />
              {savingRating && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-base-600 border-t-accent-400" />
              )}
              {showRatings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRatersList((v) => !v)}
                  className="flex items-center gap-1 text-xs text-base-400 hover:text-base-200"
                >
                  {othersAvg !== null ? (
                    <>
                      <StarGlyph />
                      {othersAvg.toFixed(1)}
                      <span className="text-base-500">
                        ({others.length} {others.length === 1 ? 'other rating' : 'other ratings'})
                      </span>
                    </>
                  ) : (
                    <span className="text-base-500">You&apos;re the first to rate this</span>
                  )}
                </button>
              )}
            </div>

            {showRatersList && showRatings.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2.5 max-w-xs space-y-1.5 border-t border-white/5 pt-2.5"
              >
                {showRatings
                  .slice()
                  .sort((a, b) => b.rating - a.rating)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-xs">
                      {r.user_id === user?.id ? (
                        <span className="text-base-300">You</span>
                      ) : (
                        <Link
                          to={`/u/${r.users?.username ?? ''}`}
                          className="text-base-300 hover:text-accent-400"
                        >
                          @{r.users?.username ?? 'unknown'}
                        </Link>
                      )}
                      <span className="flex items-center gap-1 text-star">
                        {r.rating.toFixed(1)}
                        <StarGlyph />
                      </span>
                    </li>
                  ))}
              </motion.ul>
            )}
          </div>
        )}

        {/* Watch progress */}
        {show && totalEpisodes !== null && totalEpisodes > 0 && (
          <div className="mt-4 max-w-xs">
            <div className="mb-1.5 flex items-center justify-between text-xs text-base-400">
              <span>
                {watchedCount} / {totalEpisodes} episodes watched
              </span>
              {watchedCount >= totalEpisodes && (
                <span className="text-accent-400">Finished</span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-800">
              <div
                className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
                style={{ width: `${Math.min(100, (watchedCount / totalEpisodes) * 100)}%` }}
              />
            </div>
            {watchedCount < totalEpisodes && (
              <div className="mt-2">
                <BulkMarkControl
                  label="Seen this before? Mark it all watched"
                  confirmMessage={`Mark all ${totalEpisodes} episodes of ${show.name} as watched?`}
                  onConfirm={handleMarkAllWatched}
                />
              </div>
            )}
          </div>
        )}

        {show?.overview && (
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-base-300">{show.overview}</p>
        )}

        {show?.genres && show.genres.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {show.genres.map((g) => (
              <span
                key={g.id}
                className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-base-400"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Where to watch -- one clear answer, correctable by anyone in the group */}
        {(effectiveProvider || regionProviders) && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-500">
              Streaming
            </p>
            {effectiveProvider ? (
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-base-800 ring-1 ring-white/10">
                  {providerLogoUrl(effectiveProvider.logo_path) ? (
                    <img
                      src={providerLogoUrl(effectiveProvider.logo_path) ?? undefined}
                      alt={effectiveProvider.provider_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-center text-[8px] leading-tight text-base-400">
                      {effectiveProvider.provider_name}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-base-100">{effectiveProvider.provider_name}</p>
                  {override && <p className="text-[11px] text-base-500">Set manually</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-base-500">Not free to stream in your region right now.</p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="text-[11px] text-accent-400 hover:underline"
              >
                {effectiveProvider ? "Not right? Fix it" : 'Know where? Set it'}
              </button>
              {override && (
                <button
                  type="button"
                  onClick={handleClearOverride}
                  className="text-[11px] text-base-500 hover:text-base-300"
                >
                  Reset to automatic
                </button>
              )}
              {regionProviders && (
                <a
                  href={regionProviders.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-base-500 hover:text-base-300"
                >
                  See all options (JustWatch)
                </a>
              )}
            </div>

            {pickerOpen && (
              <ProviderPicker
                region={region}
                onPick={handlePickProvider}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        )}

        {/* Seasons */}
        {show && show.seasons.length > 0 && activeSeason !== null && (
          <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <SeasonTabs seasons={show.seasons} active={activeSeason} onSelect={setActiveSeason} />
              {season && seasonWatchedCount !== null && (
                <div className="flex shrink-0 items-center gap-2 text-xs text-base-400">
                  <span>
                    {seasonWatchedCount}/{season.episodes.length} watched
                  </span>
                  {seasonWatchedCount < season.episodes.length && (
                    <BulkMarkControl
                      label="Mark season watched"
                      confirmMessage={`Mark all of ${season.name} as watched?`}
                      onConfirm={handleMarkSeasonWatched}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {loadingSeason
                ? Array.from({ length: 4 }).map((_, i) => <EpisodeRowSkeleton key={i} />)
                : season?.episodes.map((ep) => (
                    <EpisodeRow
                      key={ep.id}
                      episode={ep}
                      watched={Boolean(watched[watchedKey(ep.season_number, ep.episode_number)])}
                      watchedAt={watched[watchedKey(ep.season_number, ep.episode_number)]?.watched_at ?? null}
                      watchedAtUnknown={Boolean(
                        watched[watchedKey(ep.season_number, ep.episode_number)]?.watched_at_unknown,
                      )}
                      onToggleWatched={() => handleToggleWatched(ep.episode_number, ep.name)}
                    />
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}

/**
 * "I watched this before I started using TV Box" escape hatch -- a text
 * trigger that expands into a date picker + confirm, so a bulk log lands on
 * the right date in History instead of dating everything today.
 */
function BulkMarkControl({
  label,
  confirmMessage,
  onConfirm,
}: {
  label: string
  confirmMessage: string
  onConfirm: (input: { watchedAt: string; unknownDate: boolean }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [unknownDate, setUnknownDate] = useState(false)
  const [saving, setSaving] = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-accent-400 hover:underline"
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={date}
          max={today}
          disabled={unknownDate}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-white/10 bg-base-900 px-2 py-1 text-xs text-base-200 disabled:opacity-40"
        />
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            if (!window.confirm(confirmMessage)) return
            setSaving(true)
            try {
              await onConfirm({
                watchedAt: unknownDate ? UNKNOWN_WATCHED_AT : new Date(`${date}T12:00:00`).toISOString(),
                unknownDate,
              })
              setOpen(false)
            } finally {
              setSaving(false)
            }
          }}
          className="rounded-lg bg-accent-500/15 px-2.5 py-1 text-xs font-medium text-accent-300 ring-1 ring-accent-500/40 transition-opacity duration-150 disabled:opacity-60"
        >
          {saving ? 'Marking…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-base-500 hover:text-base-300"
        >
          Cancel
        </button>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-base-500">
        <input
          type="checkbox"
          checked={unknownDate}
          onChange={(e) => setUnknownDate(e.target.checked)}
          className="h-3 w-3 rounded border-white/20 bg-base-900 accent-accent-500"
        />
        Don&apos;t remember exactly when — just log it as watched a while ago
      </label>
    </div>
  )
}

/**
 * Small searchable panel for manually correcting "where to watch" -- backed
 * by TMDB's full provider list (not just the ones already known for this
 * show), since the whole point is fixing a wrong or missing automatic guess.
 */
function ProviderPicker({
  region,
  onPick,
  onClose,
}: {
  region: string
  onPick: (provider: TmdbProviderListItem) => void | Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [allProviders, setAllProviders] = useState<TmdbProviderListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAllTvProviders(region)
      .then((data) => {
        if (!cancelled) setAllProviders(data)
      })
      .catch(() => {
        if (!cancelled) setAllProviders([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [region])

  const matches = useMemo(() => {
    if (!allProviders) return []
    const q = query.trim().toLowerCase()
    const filtered = q ? allProviders.filter((p) => p.provider_name.toLowerCase().includes(q)) : allProviders
    return filtered.slice(0, 8)
  }, [allProviders, query])

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-base-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search platforms (Netflix, Hulu, Max...)"
          className="w-full rounded-lg border border-white/10 bg-base-950 px-2.5 py-1.5 text-xs text-base-200 placeholder:text-base-600"
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs text-base-500 hover:text-base-300"
        >
          Close
        </button>
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto">
        {loading ? (
          <p className="px-1 py-2 text-xs text-base-500">Loading platforms…</p>
        ) : matches.length === 0 ? (
          <p className="px-1 py-2 text-xs text-base-500">No matches.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {matches.map((p) => (
              <button
                key={p.provider_id}
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true)
                  try {
                    await onPick(p)
                  } finally {
                    setSaving(false)
                  }
                }}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs text-base-200 transition-colors duration-150 hover:bg-white/5 disabled:opacity-50"
              >
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded bg-base-800 ring-1 ring-white/10">
                  {providerLogoUrl(p.logo_path) ? (
                    <img
                      src={providerLogoUrl(p.logo_path) ?? undefined}
                      alt={p.provider_name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                {p.provider_name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
