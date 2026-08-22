import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import SeasonTabs from '../components/SeasonTabs'
import EpisodeRow from '../components/EpisodeRow'
import RatingSummary from '../components/RatingSummary'
import DateMarkControl from '../components/DateMarkControl'
import RewatchLogControl from '../components/RewatchLogControl'
import Toast from '../components/Toast'
import AddToListPicker from '../components/AddToListPicker'
import ProviderPicker from '../components/ProviderPicker'
import { ListGlyph, PlayGlyph, BookmarkGlyph } from '../components/ShowDetailGlyphs'
import { EpisodeRowSkeleton } from '../components/Skeletons'
import { useToast } from '../hooks/useToast'
import {
  backdropUrl,
  detectRegion,
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
import { fetchStartedItem, startShow } from '../lib/showStarted'
import { dismissShow, fetchDismissedItem, undismissShow } from '../lib/showDismissed'
import { deleteRewatch, fetchRewatchesForShow, logRewatch, restoreRewatch } from '../lib/rewatches'
import { fetchListMembershipForShow } from '../lib/lists'
import { computeSeasonProgress } from '../lib/seasonProgress'
import { getCorrectedAirDates, tvmazeEpisodeKey } from '../lib/tvmaze'
import { formatShortDate, isFutureDate } from '../lib/date'
import { useAuth } from '../contexts/AuthContext'
import type {
  EpisodeWatched,
  SeasonRatingWithUser,
  ShowRatingWithUser,
  ShowRewatch,
  ShowStarted,
  ShowWatchingDismissed,
  StreamingOverride,
  TmdbProviderListItem,
  TmdbSeasonDetail,
  TmdbShowDetail,
  TmdbWatchProviders,
  WatchedMap,
  WatchlistItem,
} from '../types'

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
  const [savingNowWatching, setSavingNowWatching] = useState(false)
  const [started, setStarted] = useState<ShowStarted | null>(null)
  const [dismissedItem, setDismissedItem] = useState<ShowWatchingDismissed | null>(null)
  const { toast, showUndo, showError, dismiss } = useToast()
  const [watchlistItem, setWatchlistItem] = useState<WatchlistItem | null>(null)
  const [savingWatchlist, setSavingWatchlist] = useState(false)
  const [rewatches, setRewatches] = useState<ShowRewatch[]>([])
  const [listMembership, setListMembership] = useState<Set<string>>(new Set())
  const [listPickerOpen, setListPickerOpen] = useState(false)
  const [correctedAirDates, setCorrectedAirDates] = useState<Map<string, string>>(new Map())

  // Load show detail + my watch progress + everyone's show/season ratings, in parallel.
  useEffect(() => {
    let cancelled = false
    setLoadingShow(true)
    setError(null)

    async function load() {
      try {
        const [
          showData,
          watchedMap,
          ratings,
          seasonRatingRows,
          watchlistRow,
          rewatchRows,
          listMembershipSet,
          startedRow,
          dismissedRow,
        ] = await Promise.all([
          getShowDetail(showId),
          user ? fetchWatchedForShow(user.id, showId) : Promise.resolve({} as WatchedMap),
          fetchAllShowRatings(showId),
          fetchAllSeasonRatingsForShow(showId),
          user ? fetchWatchlistItem(user.id, showId) : Promise.resolve(null),
          user ? fetchRewatchesForShow(user.id, showId) : Promise.resolve([]),
          user ? fetchListMembershipForShow(user.id, showId) : Promise.resolve(new Set<string>()),
          user ? fetchStartedItem(user.id, showId) : Promise.resolve(null),
          user ? fetchDismissedItem(user.id, showId) : Promise.resolve(null),
        ])
        if (cancelled) return
        setShow(showData)
        setWatched(watchedMap)
        setShowRatings(ratings)
        setSeasonRatings(seasonRatingRows)
        setWatchlistItem(watchlistRow)
        setRewatches(rewatchRows)
        setListMembership(listMembershipSet)
        setStarted(startedRow)
        setDismissedItem(dismissedRow)
        // Default to whichever season you're actually on -- the first one
        // that isn't fully watched yet (same "current season" logic Home's
        // Now Watching card already uses), not always Season 1. Falls back
        // to the first real season if there's no watch progress at all, or
        // to whatever season TMDB lists first if there's no "real" season
        // (e.g. specials-only).
        const firstRealSeason = showData.seasons.find((s) => s.season_number > 0) ?? showData.seasons[0]
        const watchedBySeasonCount: Record<number, number> = {}
        for (const row of Object.values(watchedMap)) {
          watchedBySeasonCount[row.season_number] = (watchedBySeasonCount[row.season_number] ?? 0) + 1
        }
        const progress = computeSeasonProgress(showData.seasons, watchedBySeasonCount)
        const defaultSeason = progress?.currentSeasonNumber ?? firstRealSeason?.season_number ?? null
        setActiveSeason(defaultSeason)
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

  // Air-date correction is also a nice-to-have -- see lib/tvmaze.ts. Waits
  // on `show` (rather than firing on showId directly) since it needs the
  // external_ids that come back with the show detail fetch above.
  useEffect(() => {
    if (!show) return
    let cancelled = false
    getCorrectedAirDates(show.external_ids?.imdb_id)
      .then((dates) => {
        if (!cancelled) setCorrectedAirDates(dates)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [show])

  /** TVmaze's correction for one episode's air date, or its own TMDB date
   * unchanged if there's no match -- see lib/tvmaze.ts. Single lookup point
   * shared by the "next episode" banner and every EpisodeRow below, so the
   * two can never disagree. */
  function effectiveAirDate(ep: { season_number: number; episode_number: number; air_date: string | null }): string | null {
    if (!ep.air_date) return null
    return correctedAirDates.get(tvmazeEpisodeKey(ep.season_number, ep.episode_number)) ?? ep.air_date
  }

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

  // Mirrors nowWatching()'s own filter in lib/showActivity.ts -- kept as a
  // simple boolean here (rather than importing that function) since this
  // only ever needs to know about the one show already loaded on this page.
  const isFinished = totalEpisodes !== null && watchedCount >= totalEpisodes
  const inNowWatching = (started !== null || watchedCount > 0) && !dismissedItem && !isFinished
  const canTrackNowWatching = totalEpisodes !== null && totalEpisodes > 0 && !isFinished

  const seasonWatchedCount = useMemo(() => {
    if (!season) return null
    return season.episodes.filter((ep) => watched[watchedKey(ep.season_number, ep.episode_number)]).length
  }, [season, watched])

  // The active season's episode list is already loaded (has air_date), so
  // this is just a client-side scan -- no separate fetch needed the way
  // Home's badge (a different season, not currently open) requires one.
  // "Is it upcoming" still goes by TMDB's own date (episode ordering never
  // disagrees between sources, only the exact day) -- only the *displayed*
  // date gets TVmaze's correction, see lib/tvmaze.ts.
  const nextUpcomingEpisode = useMemo(() => {
    if (!season) return null
    const ep = season.episodes.find((e) => e.air_date && isFutureDate(e.air_date)) ?? null
    if (!ep) return null
    return { ...ep, air_date: effectiveAirDate(ep) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effectiveAirDate closes over correctedAirDates, already a dep below
  }, [season, correctedAirDates])

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

  /** Best-effort "un-hide from Now Watching" -- fired after any action that
   * means the person is actively picking this show back up (marking an
   * episode watched, or tapping "Start watching" again). Doesn't need to
   * check whether the show was actually dismissed first: deleting a
   * show_watching_dismissed row that doesn't exist is already a no-op, and
   * this is a nice-to-have side effect, not something worth a loading state
   * or an error toast if it fails -- worst case the show just stays hidden
   * on Home until removed and re-added another way. */
  function clearDismissed() {
    if (!user || !show) return
    undismissShow(user.id, show.id)
      .then(() => setDismissedItem(null))
      .catch(() => {
        // Best-effort, see comment above -- fail silently.
      })
  }

  async function handleToggleWatched(episodeNumber: number, episodeName: string, runtimeMinutes: number | null) {
    if (!user || !show || activeSeason === null) return
    const key = watchedKey(activeSeason, episodeNumber)

    if (watched[key]) {
      // Snapshot so a failed unmark can be put back exactly as it was,
      // instead of the episode staying incorrectly "unwatched" in the UI
      // while the server still has it marked watched.
      const previous = watched[key]
      setWatched((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      try {
        await unmarkWatched(user.id, show.id, activeSeason, episodeNumber)
      } catch {
        setWatched((prev) => ({ ...prev, [key]: previous }))
        showError('Failed to unmark this episode. Try again.')
      }
      return
    }

    // Optimistic placeholder, swapped for the real row (with its DB id) once
    // the write resolves -- mirrors the unmark branch above so the same
    // toggle feels equally instant in both directions, instead of unmarking
    // being snappy while marking waits on a round trip.
    const optimisticRow: EpisodeWatched = {
      id: `optimistic-${key}`,
      user_id: user.id,
      show_id: show.id,
      show_name: show.name,
      show_poster_path: show.poster_path,
      show_total_episodes: show.number_of_episodes,
      season_number: activeSeason,
      episode_number: episodeNumber,
      episode_name: episodeName,
      watched_at: new Date().toISOString(),
      watched_at_unknown: false,
      runtime_minutes: runtimeMinutes,
    }
    setWatched((prev) => ({ ...prev, [key]: optimisticRow }))

    try {
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
      clearDismissed()
    } catch {
      setWatched((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      showError('Failed to mark this episode watched. Try again.')
    }
  }

  async function handleMarkAllWatched(input: { watchedAt: string; unknownDate: boolean }) {
    if (!user || !show) return
    const realSeasons = show.seasons.filter((s) => s.season_number > 0)
    // Fetch every season's episode list so each row can carry its real
    // runtime -- "Mark season watched" already does this (it starts from a
    // loaded season), and without it here, an entire show logged this way
    // would silently contribute 0 to "hours watched" forever (only fixable
    // by re-running scripts/backfill-runtime.mjs). One extra TMDB call per
    // season, but this action only runs once per show.
    const seasonDetails = await Promise.all(
      realSeasons.map((s) => getSeasonDetail(show.id, s.season_number).catch(() => null)),
    )
    const runtimeByKey = new Map<string, number | null>()
    for (const detail of seasonDetails) {
      if (!detail) continue
      for (const ep of detail.episodes) {
        runtimeByKey.set(watchedKey(ep.season_number, ep.episode_number), ep.runtime ?? null)
      }
    }
    const episodes = realSeasons.flatMap((s) =>
      Array.from({ length: s.episode_count }, (_, i) => {
        const episodeNumber = i + 1
        return {
          seasonNumber: s.season_number,
          episodeNumber,
          // Falls back to null (contributes 0 to hours watched) only if that
          // season's fetch itself failed above -- everything else gets a
          // real runtime, same as marking a season or episode individually.
          runtimeMinutes: runtimeByKey.get(watchedKey(s.season_number, episodeNumber)) ?? null,
        }
      }),
    )
    // Snapshot what's about to change *before* the write, so a mis-tap here
    // (this is exactly what silently overwrote real watch dates once) can be
    // undone instead of requiring a manual, error-prone fix.
    const { previousRows, addedKeys } = snapshotBulkTargets(episodes)
    try {
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
      clearDismissed()
      showUndo(
        previousRows.length > 0
          ? `Marked ${saved.length} episodes watched (${previousRows.length} overwritten)`
          : `Marked ${saved.length} episodes watched`,
        () => undoBulkMark(previousRows, addedKeys),
      )
    } catch {
      // Nothing was applied locally before this point, so there's nothing
      // to roll back -- just tell the user the whole batch didn't go through.
      showError('Failed to mark episodes watched. Try again.')
    }
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

  /** Undoes a bulk mark-watched action: restores episodes that were already
   * watched to their exact prior date, and deletes episodes the action
   * itself created. Passed as the undo callback on the toast set by
   * handleMarkAllWatched/handleMarkSeasonWatched below -- the toast fires
   * this without awaiting it, so it owns its own error reporting rather than
   * letting a failure become a silent unhandled rejection. */
  async function undoBulkMark(
    previousRows: EpisodeWatched[],
    addedKeys: { seasonNumber: number; episodeNumber: number }[],
  ) {
    if (!user || !show) return
    try {
      const [restored] = await Promise.all([
        restoreWatched(previousRows),
        addedKeys.length > 0 ? bulkUnmarkWatched(user.id, show.id, addedKeys) : Promise.resolve(),
      ])
      setWatched((prev) => {
        const next = { ...prev }
        for (const key of addedKeys) delete next[watchedKey(key.seasonNumber, key.episodeNumber)]
        for (const row of restored) next[watchedKey(row.season_number, row.episode_number)] = row
        return next
      })
    } catch {
      showError('Failed to undo. Your watch history wasn’t changed back — try again.')
    }
  }

  /** "Start watching" -- the manual add-to-Now-Watching entry point for a
   * show you're about to start but haven't logged any episodes for yet.
   * This used to fake progress by marking episode 1 watched (so Now
   * Watching, a pure derivation of episode_watched, would pick the show up)
   * -- but that meant an episode you hadn't actually seen showed up in real
   * watch history. It now just records a standalone "started" declaration
   * (show_started); Now Watching shows 0/x until an episode is genuinely
   * marked watched. One tap, stamped "now" -- a declaration that you're
   * starting today, not a past event to date, so unlike the other bulk
   * actions it skips the date picker entirely. */
  async function handleStartWatching() {
    if (!user || !show) return
    setSavingNowWatching(true)
    try {
      const row = await startShow({
        userId: user.id,
        showId: show.id,
        showName: show.name,
        showPosterPath: show.poster_path,
        showTotalEpisodes: show.number_of_episodes,
      })
      setStarted(row)
      clearDismissed()
    } catch {
      showError('Failed to start watching. Try again.')
    } finally {
      setSavingNowWatching(false)
    }
  }

  /** Un-hides a show that already has real progress or a "started"
   * declaration but was previously removed from Now Watching -- the
   * dismissed-but-not-brand-new counterpart to handleStartWatching above.
   * Deliberate user action (clicking the toggle), so unlike clearDismissed
   * this reports a failure instead of swallowing it. */
  async function handleAddBackToNowWatching() {
    if (!user || !show) return
    setSavingNowWatching(true)
    const previous = dismissedItem
    setDismissedItem(null)
    try {
      await undismissShow(user.id, show.id)
    } catch {
      setDismissedItem(previous)
      showError('Failed to add back to Now Watching. Try again.')
    } finally {
      setSavingNowWatching(false)
    }
  }

  /** "Remove from Now Watching" -- the toggle's other direction. Hides the
   * show from Home without touching show_started/episode_watched (see
   * lib/showDismissed.ts); resuming the show from any of the actions above
   * (clearDismissed) brings it back automatically, so this is a soft "not
   * right now" rather than a hard reset. Same optimistic + Undo shape as
   * every other reversible action on this page. */
  async function handleRemoveFromNowWatching() {
    if (!user || !show) return
    setSavingNowWatching(true)
    const previous = dismissedItem
    setDismissedItem({
      id: `optimistic-${show.id}`,
      user_id: user.id,
      show_id: show.id,
      dismissed_at: new Date().toISOString(),
    })
    try {
      const row = await dismissShow(user.id, show.id)
      setDismissedItem(row)
    } catch {
      setDismissedItem(previous)
      showError('Failed to remove from Now Watching. Try again.')
      return
    } finally {
      setSavingNowWatching(false)
    }
    showUndo('Removed from Now Watching', async () => {
      try {
        await undismissShow(user.id, show.id)
        setDismissedItem(null)
      } catch {
        showError('Failed to undo. Try again.')
      }
    })
  }

  /** Single entry point for the Now Watching pill in the quick-actions row --
   * picks the right one of the three handlers above based on current state,
   * so the button itself doesn't need to know the underlying model. */
  function handleToggleNowWatching() {
    if (inNowWatching) handleRemoveFromNowWatching()
    else if (dismissedItem) handleAddBackToNowWatching()
    else handleStartWatching()
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
    try {
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
      if (saved[0]) {
        setWatched((prev) => ({ ...prev, [key]: saved[0] }))
        clearDismissed()
      }
    } catch {
      showError('Failed to mark this episode watched. Try again.')
    }
  }

  async function handleMarkSeasonWatched(input: { watchedAt: string; unknownDate: boolean }) {
    if (!user || !show || !season) return
    // Skip TMDB's not-yet-aired placeholder episodes (future air_date) -- see
    // the matching check in EpisodeRow.tsx. Marking these "watched" in bulk
    // would be the same nonsensical action a single click is now blocked from.
    const episodes = season.episodes
      .filter((ep) => !(ep.air_date && isFutureDate(ep.air_date)))
      .map((ep) => ({
        seasonNumber: ep.season_number,
        episodeNumber: ep.episode_number,
        episodeName: ep.name,
        runtimeMinutes: ep.runtime,
      }))
    const { previousRows, addedKeys } = snapshotBulkTargets(episodes)
    try {
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
      clearDismissed()
      showUndo(
        previousRows.length > 0
          ? `Marked ${saved.length} episodes watched (${previousRows.length} overwritten)`
          : `Marked ${saved.length} episodes watched`,
        () => undoBulkMark(previousRows, addedKeys),
      )
    } catch {
      showError('Failed to mark season watched. Try again.')
    }
  }

  /** Toggle for "want to watch", independent of watch progress -- you can
   * add or remove a show from your watchlist regardless of whether you've
   * started it, rather than this being auto-managed. */
  async function handleToggleWatchlist() {
    if (!user || !show) return
    setSavingWatchlist(true)
    try {
      if (watchlistItem) {
        const previous = watchlistItem
        setWatchlistItem(null)
        try {
          await removeFromWatchlist(user.id, show.id)
        } catch {
          setWatchlistItem(previous)
          showError('Failed to remove from watchlist. Try again.')
          return
        }
        // A watchlist remove is one accidental tap away from "want to watch"
        // silently vanishing -- offer the same undo affordance bulk
        // mark-watched already gets, instead of making the user re-search
        // and re-add the show from scratch.
        showUndo('Removed from watchlist', async () => {
          try {
            const saved = await addToWatchlist({
              userId: user.id,
              showId: show.id,
              showName: show.name,
              showPosterPath: show.poster_path,
            })
            setWatchlistItem(saved)
          } catch {
            showError('Failed to undo. Try adding it to your watchlist again.')
          }
        })
      } else {
        try {
          const saved = await addToWatchlist({
            userId: user.id,
            showId: show.id,
            showName: show.name,
            showPosterPath: show.poster_path,
          })
          setWatchlistItem(saved)
        } catch {
          showError('Failed to add to watchlist. Try again.')
        }
      }
    } finally {
      setSavingWatchlist(false)
    }
  }

  /** Logs a rewatch -- a separate, append-only event, not a change to
   * episode_watched (which stays exactly what it's always meant: first-time
   * progress toward "finished"). Only ever offered once a show is finished.
   * rewatchedAt comes from RewatchLogControl's confirm step, not straight
   * from a click handler -- see that component for why. */
  async function handleLogRewatch(rewatchedAt: string) {
    if (!user || !show) return
    try {
      const saved = await logRewatch({
        userId: user.id,
        showId: show.id,
        showName: show.name,
        showPosterPath: show.poster_path,
        rewatchedAt,
      })
      setRewatches((prev) => [saved, ...prev])
    } catch {
      showError('Failed to log this rewatch. Try again.')
    }
  }

  async function handleDeleteRewatch(id: string) {
    const removed = rewatches.find((r) => r.id === id)
    setRewatches((prev) => prev.filter((r) => r.id !== id))
    try {
      await deleteRewatch(id)
    } catch {
      if (removed) setRewatches((prev) => [removed, ...prev])
      showError('Failed to remove this rewatch. Try again.')
      return
    }
    if (removed) {
      // Symmetrical with every other removal in the app -- a rewatch log
      // entry is just as easy to mis-tap the × on as a watchlist/list item.
      showUndo('Rewatch removed', async () => {
        try {
          const restored = await restoreRewatch(removed)
          setRewatches((prev) => [restored, ...prev])
        } catch {
          showError('Failed to undo. Try logging the rewatch again.')
        }
      })
    }
  }

  async function handlePickProvider(p: TmdbProviderListItem) {
    if (!user || !show) return
    try {
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
    } catch {
      showError('Failed to set streaming provider. Try again.')
    }
  }

  async function handleClearOverride() {
    if (!show) return
    try {
      await clearStreamingOverride(show.id)
      setOverride(null)
      invalidatePlatformCache(show.id)
    } catch {
      showError('Failed to reset streaming provider. Try again.')
    }
  }

  async function handleRateShow(value: number) {
    if (!user || !show) return
    setSavingRating(true)
    try {
      if (value === 0) {
        const previous = showRatings
        setShowRatings((prev) => prev.filter((r) => r.user_id !== user.id))
        try {
          await deleteShowRating(user.id, show.id)
        } catch {
          setShowRatings(previous)
          showError('Failed to clear your rating. Try again.')
        }
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
    } catch {
      showError('Failed to save your rating. Try again.')
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
        const previous = seasonRatings
        setSeasonRatings((prev) =>
          prev.filter((r) => !(r.user_id === user.id && r.season_number === activeSeason)),
        )
        try {
          await deleteSeasonRating(user.id, show.id, activeSeason)
        } catch {
          setSeasonRatings(previous)
          showError('Failed to clear your season rating. Try again.')
        }
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
    } catch {
      showError('Failed to save your season rating. Try again.')
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

        {/* Quick actions: Now Watching / watchlist / list toggles -- all
            independent of each other and available regardless of progress. */}
        {show && !loadingShow && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canTrackNowWatching && (
              <button
                type="button"
                onClick={handleToggleNowWatching}
                disabled={savingNowWatching}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 disabled:opacity-60 ${
                  inNowWatching
                    ? 'border-accent-500/40 bg-accent-500/15 text-accent-300'
                    : 'border-hairline-strong text-base-400 hover:border-accent-500/40 hover:text-base-200'
                }`}
              >
                <PlayGlyph filled={inNowWatching} />
                {inNowWatching
                  ? 'Remove from Now Watching'
                  : dismissedItem
                    ? 'Add to Now Watching'
                    : 'Start watching'}
              </button>
            )}

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

            <button
              type="button"
              onClick={() => setListPickerOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                listMembership.size > 0
                  ? 'border-accent-500/40 bg-accent-500/15 text-accent-300'
                  : 'border-hairline-strong text-base-400 hover:border-accent-500/40 hover:text-base-200'
              }`}
            >
              <ListGlyph />
              {listMembership.size > 0
                ? `On ${listMembership.size} list${listMembership.size === 1 ? '' : 's'}`
                : 'Add to a list'}
            </button>
          </div>
        )}

        {listPickerOpen && user && show && (
          <div className="max-w-md">
            <AddToListPicker
              userId={user.id}
              showId={show.id}
              showName={show.name}
              showPosterPath={show.poster_path}
              memberOf={listMembership}
              onChange={setListMembership}
              onClose={() => setListPickerOpen(false)}
            />
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
                <RewatchLogControl count={rewatches.length} onConfirm={handleLogRewatch} />
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
            {nextUpcomingEpisode && (
              <p className="mb-3 text-xs text-base-500">
                Next: S{nextUpcomingEpisode.season_number}E{nextUpcomingEpisode.episode_number} airs{' '}
                {formatShortDate(nextUpcomingEpisode.air_date!)}
              </p>
            )}

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
                      episode={ep.air_date ? { ...ep, air_date: effectiveAirDate(ep) } : ep}
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

      {toast && <Toast message={toast.message} tone={toast.tone} action={toast.action} onDismiss={dismiss} />}
    </div>
  )
}
