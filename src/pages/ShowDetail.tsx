import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import SeasonTabs from '../components/SeasonTabs'
import EpisodeRow from '../components/EpisodeRow'
import RatingSummary from '../components/RatingSummary'
import DateMarkControl from '../components/DateMarkControl'
import UndoToast from '../components/UndoToast'
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
  fetchAllSeasonRatingsForShow,
  upsertSeasonRating,
  deleteSeasonRating,
} from '../lib/seasonRatings'
import {
  bulkMarkWatched,
  bulkUnmarkWatched,
  fetchWatchedForShow,
  markWatched,
  restoreWatched,
  unmarkWatched,
  watchedKey,
} from '../lib/watched'
import { clearStreamingOverride, fetchStreamingOverride, setStreamingOverride } from '../lib/streamingOverrides'
import { invalidatePlatformCache, pickBestFreeProvider } from '../lib/streamingProvider'
import { addToWatchlist, fetchWatchlistItem, removeFromWatchlist } from '../lib/watchlist'
import { deleteRewatch, fetchRewatchesForShow, logRewatch } from '../lib/rewatches'
import { formatShortDate } from '../lib/date'
import { useAuth } from '../contexts/AuthContext'
import type {
  EpisodeWatched,
  SeasonRatingWithUser,
  ShowRatingWithUser,
  ShowRewatch,
  StreamingOverride,
  TmdbProviderListItem,
  TmdbSeasonDetail,
  TmdbShowDetail,
  TmdbWatchProviders,
  WatchedMap,
  WatchlistItem,
} from '../types'

/** What a bulk mark-watched action changed, so it can be undone -- see
 * UndoToast below. `previousRows` are episodes that were already watched
 * (their exact prior state, to restore); `addedKeys` are episodes that
 * didn't exist before (to delete on undo, not "restore"). */
interface BulkMarkUndo {
  message: string
  previousRows: EpisodeWatched[]
  addedKeys: { seasonNumber: number; episodeNumber: number }[]
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
  const [seasonRatings, setSeasonRatings] = useState<SeasonRatingWithUser[]>([])
  const [loadingShow, setLoadingShow] = useState(true)
  const [loadingSeason, setLoadingSeason] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingRating, setSavingRating] = useState(false)
  const [savingSeasonRating, setSavingSeasonRating] = useState(false)
  const [providers, setProviders] = useState<TmdbWatchProviders | null>(null)
  const [override, setOverride] = useState<StreamingOverride | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [startingWatch, setStartingWatch] = useState(false)
  const [bulkUndo, setBulkUndo] = useState<BulkMarkUndo | null>(null)
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null)
  const [savingWatchlist, setSavingWatchlist] = useState(false)
  const [rewatches, setRewatches] = useState<ShowRewatch[]>([])
  const [loggingRewatch, setLoggingRewatch] = useState(false)

  // Load show detail + my watch progress + everyone's show/season ratings, in parallel.
  useEffect(() => {
    let cancelled = false
    setLoadingShow(true)
    setError(null)

    async function load() {
      try {
        const [showData, watchedMap, ratings, seasonRatingRows, watchlistRow, rewatchRows] = await Promise.all([
          getShowDetail(showId),
          user ? fetchWatchedForShow(user.id, showId) : Promise.resolve({}),
          fetchAllShowRatings(showId),
          fetchAllSeasonRatingsForShow(showId),
          user ? fetchWatchlistItem(user.id, showId) : Promise.resolve(null),
          user ? fetchRewatchesForShow(user.id, showId) : Promise.resolve([]),
        ])
        if (cancelled) return
        setShow(showData)
        setWatched(watchedMap)
        setShowRatings(ratings)
        setSeasonRatings(seasonRatingRows)
        setWatchlistItem(watchlistRow)
        setRewatches(rewatchRows)
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

  // The single best-guess "free to you" answer -- shared with the History/
  // Activity "sort by platform" grouping so the two never disagree.
  const bestFreeProvider = useMemo(() => pickBestFreeProvider(regionProviders), [regionProviders])

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

  const seasonRatingsForActive = useMemo(
    () => (activeSeason === null ? [] : seasonRatings.filter((r) => r.season_number === activeSeason)),
    [seasonRatings, activeSeason],
  )
  const mySeasonRating = useMemo(
    () => seasonRatingsForActive.find((r) => r.user_id === user?.id) ?? null,
    [seasonRatingsForActive, user],
  )

  async function handleToggleWatched(episodeNumber: number, episodeName: string, runtimeMinutes: number | null) {
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
      runtimeMinutes,
    })
    setWatched((prev) => ({ ...prev, [key]: saved }))
  }

  async function handleMarkAllWatched(input: { watchedAt: string; unknownDate: boolean }) {
    if (!user || !show) return
    // No runtimeMinutes here -- show.seasons only has per-season episode
    // counts, not per-episode runtimes (that needs a full season fetch,
    // which this fast whole-show action deliberately skips). Those rows
    // just contribute 0 to "hours watched" rather than blocking the action.
    const episodes = show.seasons
      .filter((s) => s.season_number > 0)
      .flatMap((s) =>
        Array.from({ length: s.episode_count }, (_, i) => ({
          seasonNumber: s.season_number,
          episodeNumber: i + 1,
        })),
      )
    // Snapshot what's about to change *before* the write, so a mis-tap here
    // (this is exactly what silently overwrote real watch dates once) can be
    // undone instead of requiring a manual, error-prone fix.
    const { previousRows, addedKeys } = snapshotBulkTargets(episodes)
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
    setBulkUndo({
      message:
        previousRows.length > 0
          ? `Marked ${saved.length} episodes watched (${previousRows.length} overwritten)`
          : `Marked ${saved.length} episodes watched`,
      previousRows,
      addedKeys,
    })
  }

  /** Splits a batch of (season, episode) targets into ones that already had
   * a watched row (captured in full, so undo can restore their exact prior
   * date) and ones that don't exist yet (captured as keys, so undo just
   * deletes them). Shared by both bulk actions below. */
  function snapshotBulkTargets(
    episodes: { seasonNumber: number; episodeNumber: number }[],
  ): { previousRows: EpisodeWatched[]; addedKeys: { seasonNumber: number; episodeNumber: number }[] } {
    const previousRows: EpisodeWatched[] = []
    const addedKeys: { seasonNumber: number; episodeNumber: number }[] = []
    for (const ep of episodes) {
      const existing = watched[watchedKey(ep.seasonNumber, ep.episodeNumber)]
      if (existing) previousRows.push(existing)
      else addedKeys.push(ep)
    }
    return { previousRows, addedKeys }
  }

  /** Undoes whichever bulk action last ran: restores episodes that were
   * already watched to their exact prior date, and deletes episodes the
   * action itself created. */
  async function handleUndoBulkMark() {
    if (!bulkUndo || !user || !show) return
    const snapshot = bulkUndo
    setBulkUndo(null)
    const [restored] = await Promise.all([
      restoreWatched(snapshot.previousRows),
      snapshot.addedKeys.length > 0
        ? bulkUnmarkWatched(user.id, show.id, snapshot.addedKeys)
        : Promise.resolve(),
    ])
    setWatched((prev) => {
      const next = { ...prev }
      for (const key of snapshot.addedKeys) delete next[watchedKey(key.seasonNumber, key.episodeNumber)]
      for (const row of restored) next[watchedKey(row.season_number, row.episode_number)] = row
      return next
    })
  }

  /** "Start watching" -- the manual add-to-Now-Watching entry point. Rather
   * than a separate status field to keep in sync with the real watch data,
   * this just marks the first episode watched: Now Watching is (and stays)
   * a pure derivation of episode_watched, so there's only ever one source
   * of truth for what's in progress. One tap, stamped "now" -- this is a
   * declaration that you're starting today, not a past event to date, so
   * unlike the other bulk actions it skips the date picker entirely. */
  async function handleStartWatching() {
    if (!user || !show) return
    const firstSeason = show.seasons.find((s) => s.season_number > 0) ?? show.seasons[0]
    if (!firstSeason) return
    const firstEpisode =
      season && season.season_number === firstSeason.season_number
        ? (season.episodes.find((ep) => ep.episode_number === 1) ?? null)
        : null
    setStartingWatch(true)
    try {
      const saved = await bulkMarkWatched({
        userId: user.id,
        showId: show.id,
        showName: show.name,
        showPosterPath: show.poster_path,
        showTotalEpisodes: show.number_of_episodes,
        episodes: [
          {
            seasonNumber: firstSeason.season_number,
            episodeNumber: 1,
            episodeName: firstEpisode?.name ?? null,
            runtimeMinutes: firstEpisode?.runtime ?? null,
          },
        ],
        watchedAt: new Date().toISOString(),
        watchedAtUnknown: false,
      })
      setWatched((prev) => {
        const next = { ...prev }
        for (const row of saved) next[watchedKey(row.season_number, row.episode_number)] = row
        return next
      })
    } finally {
      setStartingWatch(false)
    }
  }

  /** Same idea as handleToggleWatched, but for logging a single episode on a
   * specific past date instead of always stamping "now". */
  async function handleMarkWatchedWithDate(
    episodeNumber: number,
    episodeName: string,
    runtimeMinutes: number | null,
    input: { watchedAt: string; unknownDate: boolean },
  ) {
    if (!user || !show || activeSeason === null) return
    const key = watchedKey(activeSeason, episodeNumber)
    const saved = await bulkMarkWatched({
      userId: user.id,
      showId: show.id,
      showName: show.name,
      showPosterPath: show.poster_path,
      showTotalEpisodes: show.number_of_episodes,
      episodes: [{ seasonNumber: activeSeason, episodeNumber, episodeName, runtimeMinutes }],
      watchedAt: input.watchedAt,
      watchedAtUnknown: input.unknownDate,
    })
    if (saved[0]) setWatched((prev) => ({ ...prev, [key]: saved[0] }))
  }

  async function handleMarkSeasonWatched(input: { watchedAt: string; unknownDate: boolean }) {
    if (!user || !show || !season) return
    // Skip TMDB's not-yet-aired placeholder episodes (future air_date) -- see
    // the matching check in EpisodeRow.tsx. Marking these "watched" in bulk
    // would be the same nonsensical action a single click is now blocked from.
    const episodes = season.episodes
      .filter((ep) => !(ep.air_date && new Date(ep.air_date) > new Date()))
      .map((ep) => ({
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        episodeName: ep.name,
        runtimeMinutes: ep.runtime,
      }))
    const { previousRows, addedKeys } = snapshotBulkTargets(episodes)
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
    setBulkUndo({
      message:
        previousRows.length > 0
          ? `Marked ${saved.length} episodes watched (${previousRows.length} overwritten)`
          : `Marked ${saved.length} episodes watched`,
      previousRows,
      addedKeys,
    })
  }

  /** Toggle for "want to watch", independent of watch progress -- you can
   * add or remove a show from your watchlist regardless of whether you've
   * started it, rather than this being auto-managed. */
  async function handleToggleWatchlist() {
    if (!user || !show) return
    setSavingWatchlist(true)
    try {
      if (watchlistItem) {
        setWatchlistItem(null)
        await removeFromWatchlist(user.id, show.id)
      } else {
        const saved = await addToWatchlist({
          userId: user.id,
          showId: show.id,
          showName: show.name,
          showPosterPath: show.poster_path,
        })
        setWatchlistItem(saved)
      }
    } finally {
      setSavingWatchlist(false)
    }
  }

  /** Logs a rewatch -- a separate, append-only event, not a change to
   * episode_watched (which stays exactly what it's always meant: first-time
   * progress toward "finished"). Only ever offered once a show is finished. */
  async function handleLogRewatch() {
    if (!user || !show) return
    setLoggingRewatch(true)
    try {
      const saved = await logRewatch({
        userId: user.id,
        showId: show.id,
        showName: show.name,
        showPosterPath: show.poster_path,
      })
      setRewatches((prev) => [saved, ...prev])
    } finally {
      setLoggingRewatch(false)
    }
  }

  async function handleDeleteRewatch(id: string) {
    setRewatches((prev) => prev.filter((r) => r.id !== id))
    await deleteRewatch(id)
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
    // The poster badges on Home/History/Search read from a cached answer --
    // without this they'd keep showing the old provider until a hard reload.
    invalidatePlatformCache(show.id)
  }

  async function handleClearOverride() {
    if (!show) return
    await clearStreamingOverride(show.id)
    setOverride(null)
    invalidatePlatformCache(show.id)
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

  /** Same shape as handleRateShow, but scoped to whichever season tab is
   * active -- a separate, independent rating rather than a component of
   * the show-level one. */
  async function handleRateSeason(value: number) {
    if (!user || !show || activeSeason === null) return
    setSavingSeasonRating(true)
    try {
      if (value === 0) {
        setSeasonRatings((prev) =>
          prev.filter((r) => !(r.user_id === user.id && r.season_number === activeSeason)),
        )
        await deleteSeasonRating(user.id, show.id, activeSeason)
        return
      }
      const saved = await upsertSeasonRating({
        userId: user.id,
        showId: show.id,
        showName: show.name,
        showPosterPath: show.poster_path,
        seasonNumber: activeSeason,
        seasonName: season?.season_number === activeSeason ? season.name : null,
        rating: value,
      })
      setSeasonRatings((prev) => [
        ...prev.filter((r) => !(r.user_id === user.id && r.season_number === activeSeason)),
        { ...saved, users: { username: user.username } },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save season rating.')
    } finally {
      setSavingSeasonRating(false)
    }
  }

  if (Number.isNaN(showId)) {
    return <p className="p-8 text-center text-sm text-danger">Invalid show.</p>
  }

  if (error && !show) {
    return <p className="p-8 text-center text-sm text-danger">{error}</p>
  }

  return (
    <div className="pb-24 md:pb-10">
      {/* Hero */}
      <div className="relative h-56 w-full overflow-hidden sm:h-auto sm:aspect-[3/1] sm:max-h-[520px]">
        {show?.backdrop_path ? (
          <img
            src={backdropUrl(show.backdrop_path) ?? undefined}
            alt=""
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-base-850" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base-950 via-base-950/70 to-base-950/20" />
      </div>

      {/* relative: the hero above is a positioned element (position: relative
          for its own overflow-hidden crop), so without this, this static
          sibling would paint *behind* it wherever the negative margin makes
          them overlap -- silently clipping the top of the poster even though
          the poster's own box is sized perfectly correctly. */}
      <div className="relative mx-auto -mt-24 max-w-5xl px-4 sm:-mt-28 sm:px-6 lg:-mt-32">
        <div className="flex items-start gap-4 sm:gap-6">
          <div className="aspect-[2/3] w-32 shrink-0 self-start overflow-hidden rounded-xl bg-base-800 shadow-2xl shadow-black/50 ring-1 ring-hairline-strong sm:w-44 lg:w-52">
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
            <RatingSummary
              ratings={showRatings}
              myRating={myShowRating?.rating ?? 0}
              onChange={handleRateShow}
              saving={savingRating}
              currentUserId={user?.id}
              size="lg"
            />
          </div>
        )}

        {/* Quick actions: watchlist toggle -- independent of watch progress,
            so it's available whether or not you've started the show. */}
        {show && !loadingShow && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleWatchlist}
              disabled={savingWatchlist}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 disabled:opacity-60 ${
                watchlistItem
                  ? 'border-accent-500/40 bg-accent-500/15 text-accent-300'
                  : 'border-hairline-strong text-base-400 hover:border-accent-500/40 hover:text-base-200'
              }`}
            >
              <BookmarkGlyph filled={Boolean(watchlistItem)} />
              {watchlistItem ? 'On your watchlist' : 'Add to watchlist'}
            </button>
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
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {watchedCount === 0 && (
                  <button
                    type="button"
                    onClick={handleStartWatching}
                    disabled={startingWatch}
                    className="text-xs text-accent-400 hover:underline disabled:opacity-60"
                  >
                    {startingWatch ? 'Adding…' : 'Start watching'}
                  </button>
                )}
                <DateMarkControl
                  label="Seen this before? Mark it all watched"
                  onConfirm={handleMarkAllWatched}
                  confirmSummary={
                    watchedCount > 0
                      ? `This will overwrite the date on ${watchedCount} already-watched episode${watchedCount === 1 ? '' : 's'}.`
                      : undefined
                  }
                />
              </div>
            )}

            {/* Rewatches -- a separate append-only log, only offered once
                the show is actually finished. */}
            {watchedCount >= totalEpisodes && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleLogRewatch}
                  disabled={loggingRewatch}
                  className="text-xs text-accent-400 hover:underline disabled:opacity-60"
                >
                  {loggingRewatch
                    ? 'Logging…'
                    : rewatches.length > 0
                      ? `Log another rewatch (${rewatches.length} so far)`
                      : 'Log a rewatch'}
                </button>
                {rewatches.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {rewatches.map((r) => (
                      <li
                        key={r.id}
                        className="inline-flex items-center gap-1 rounded-full bg-hover-strong px-2 py-0.5 text-[11px] text-base-400"
                      >
                        {formatShortDate(r.rewatched_at)}
                        <button
                          type="button"
                          onClick={() => handleDeleteRewatch(r.id)}
                          className="text-base-500 hover:text-danger"
                          aria-label="Remove this rewatch"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                className="rounded-full border border-hairline-strong px-2.5 py-0.5 text-[11px] text-base-400"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Where to watch -- one clear answer, correctable by anyone in the group */}
        {(effectiveProvider || regionProviders) && (
          <div className="mt-6 max-w-md rounded-2xl border border-hairline bg-base-850/40 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-500">
              Streaming
            </p>
            {effectiveProvider ? (
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-base-800 ring-1 ring-hairline-strong">
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
          <div className="mt-8 border-t border-hairline pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <SeasonTabs seasons={show.seasons} active={activeSeason} onSelect={setActiveSeason} />
              {season && seasonWatchedCount !== null && (
                <div className="flex shrink-0 items-center gap-2 text-xs text-base-400">
                  <span>
                    {seasonWatchedCount}/{season.episodes.length} watched
                  </span>
                  {seasonWatchedCount < season.episodes.length && (
                    <DateMarkControl
                      label="Mark season watched"
                      onConfirm={handleMarkSeasonWatched}
                      confirmSummary={
                        seasonWatchedCount > 0
                          ? `This will overwrite the date on ${seasonWatchedCount} already-watched episode${seasonWatchedCount === 1 ? '' : 's'} in this season.`
                          : undefined
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {/* Season rating -- independent of the show-level one above, the
                way IMDb/Rotten Tomatoes show a season score next to a show's
                overall one, not averaged into or out of it. */}
            <div className="mb-5">
              <RatingSummary
                ratings={seasonRatingsForActive}
                myRating={mySeasonRating?.rating ?? 0}
                onChange={handleRateSeason}
                saving={savingSeasonRating}
                currentUserId={user?.id}
                size="md"
                emptyLabel="You're the first to rate this season"
              />
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
                      onToggleWatched={() => handleToggleWatched(ep.episode_number, ep.name, ep.runtime)}
                      onMarkWatchedWithDate={(input) =>
                        handleMarkWatchedWithDate(ep.episode_number, ep.name, ep.runtime, input)
                      }
                    />
                  ))}
            </div>
          </div>
        )}
      </div>

      {bulkUndo && (
        <UndoToast
          message={bulkUndo.message}
          onUndo={handleUndoBulkMark}
          onDismiss={() => setBulkUndo(null)}
        />
      )}
    </div>
  )
}

function BookmarkGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1Z"
        fill={filled ? 'var(--color-accent-400)' : 'none'}
        stroke={filled ? 'var(--color-accent-400)' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
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
    <div className="mt-2 rounded-xl border border-hairline-strong bg-base-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search platforms (Netflix, Hulu, Max...)"
          className="w-full rounded-lg border border-hairline-strong bg-base-950 px-2.5 py-1.5 text-xs text-base-200 placeholder:text-base-600"
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
                className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs text-base-200 transition-colors duration-150 hover:bg-hover disabled:opacity-50"
              >
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded bg-base-800 ring-1 ring-hairline-strong">
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
