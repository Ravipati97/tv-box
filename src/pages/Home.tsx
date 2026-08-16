import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchRecentShowRatings, fetchRecentShowRatingsAllUsers } from '../lib/showRatings'
import { fetchRecentSeasonRatingsAllUsers } from '../lib/seasonRatings'
import { fetchRecentWatched, fetchRecentWatchedAllUsers } from '../lib/watched'
import { fetchStartedForUser } from '../lib/showStarted'
import { fetchDismissedForUser } from '../lib/showDismissed'
import { fetchWatchlist } from '../lib/watchlist'
import { summarizeShowActivity, nowWatching, buildGroupActivity } from '../lib/showActivity'
import type { GroupActivityEvent } from '../lib/showActivity'
import { computeSeasonProgress, fetchNextEpisode, fetchSeasonBreakdowns } from '../lib/seasonProgress'
import type { NextEpisode, SeasonProgress } from '../lib/seasonProgress'
import { useStreamingPlatforms } from '../hooks/useStreamingPlatforms'
import { posterUrl } from '../lib/tmdb'
import { formatShortDate } from '../lib/date'
import ActivityRow from '../components/ActivityRow'
import SeasonProgressBar from '../components/SeasonProgressBar'
import StreamingBadge from '../components/StreamingBadge'
import { ShowGridSkeleton } from '../components/Skeletons'
import type { EpisodeWatched, ShowRating, ShowStarted, ShowWatchingDismissed, WatchlistItem } from '../types'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Home() {
  const { user } = useAuth()
  const [ratings, setRatings] = useState<ShowRating[]>([])
  const [watched, setWatched] = useState<EpisodeWatched[]>([])
  const [started, setStarted] = useState<ShowStarted[]>([])
  const [dismissed, setDismissed] = useState<ShowWatchingDismissed[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [groupActivity, setGroupActivity] = useState<GroupActivityEvent[]>([])
  const [loadingGroup, setLoadingGroup] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRecentShowRatings(user.id, 2000),
      fetchRecentWatched(user.id, 2000),
      fetchStartedForUser(user.id),
      fetchDismissedForUser(user.id),
      fetchWatchlist(user.id),
    ])
      .then(([ratingRows, watchedRows, startedRows, dismissedRows, watchlistRows]) => {
        if (!cancelled) {
          setRatings(ratingRows)
          setWatched(watchedRows)
          setStarted(startedRows)
          setDismissed(dismissedRows)
          setWatchlist(watchlistRows)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load your shows.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    let cancelled = false
    setLoadingGroup(true)
    Promise.all([
      fetchRecentShowRatingsAllUsers(150),
      fetchRecentWatchedAllUsers(400),
      fetchRecentSeasonRatingsAllUsers(150),
    ])
      .then(([ratingRows, watchedRows, seasonRatingRows]) => {
        if (!cancelled) setGroupActivity(buildGroupActivity(ratingRows, watchedRows, seasonRatingRows))
      })
      .catch(() => {
        // The teaser is a nice-to-have -- fail quietly, the full page will surface errors.
      })
      .finally(() => {
        if (!cancelled) setLoadingGroup(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activity = useMemo(
    () => summarizeShowActivity(ratings, watched, started, dismissed),
    [ratings, watched, started, dismissed],
  )
  const watching = useMemo(() => nowWatching(activity), [activity])
  const recentGroupActivity = groupActivity.slice(0, 5)

  // Per-season watched counts for everything in progress -- lets the card
  // below say "Season 4 · 2/10" instead of a flat, hard-to-parse "10/44".
  const watchedBySeasonByShow = useMemo(() => {
    const map = new Map<number, Record<number, number>>()
    for (const w of watched) {
      const bucket = map.get(w.show_id) ?? {}
      bucket[w.season_number] = (bucket[w.season_number] ?? 0) + 1
      map.set(w.show_id, bucket)
    }
    return map
  }, [watched])

  const [seasonProgress, setSeasonProgress] = useState<Map<number, SeasonProgress>>(new Map())
  const watchingIds = useMemo(() => watching.map((s) => s.showId), [watching])
  const watchingKey = watchingIds.join(',')
  const { platforms } = useStreamingPlatforms(watchingIds)

  useEffect(() => {
    if (!watchingKey) {
      setSeasonProgress(new Map())
      return
    }
    let cancelled = false
    const showIds = watchingKey.split(',').map(Number)
    fetchSeasonBreakdowns(showIds)
      .then((breakdowns) => {
        if (cancelled) return
        const next = new Map<number, SeasonProgress>()
        for (const id of showIds) {
          const seasons = breakdowns.get(id)
          if (!seasons) continue
          const progress = computeSeasonProgress(seasons, watchedBySeasonByShow.get(id) ?? {})
          if (progress) next.set(id, progress)
        }
        setSeasonProgress(next)
      })
      .catch(() => {
        // Nice-to-have -- the card below falls back to the flat total.
      })
    return () => {
      cancelled = true
    }
  }, [watchingKey, watchedBySeasonByShow])

  // "New episode soon" badge -- needs each show's *current* season's
  // per-episode air dates, which seasonProgress above doesn't carry (only
  // season-level episode counts), so this is a second, separate fetch keyed
  // off the current-season number that fetch already worked out.
  const [nextEpisodes, setNextEpisodes] = useState<Map<number, NextEpisode>>(new Map())

  useEffect(() => {
    if (seasonProgress.size === 0) {
      setNextEpisodes(new Map())
      return
    }
    let cancelled = false
    Promise.all(
      Array.from(seasonProgress.entries()).map(async ([showId, progress]) => {
        const next = await fetchNextEpisode(showId, progress.currentSeasonNumber)
        return [showId, next] as const
      }),
    ).then((results) => {
      if (cancelled) return
      const map = new Map<number, NextEpisode>()
      for (const [showId, next] of results) {
        if (next) map.set(showId, next)
      }
      setNextEpisodes(map)
    })
    return () => {
      cancelled = true
    }
  }, [seasonProgress])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="text-sm font-medium text-accent-400">
          {greeting()}
          {user ? `, @${user.username}` : ''}
        </p>
        <h1 className="font-display mt-0.5 text-xl font-semibold text-base-100 sm:text-2xl">
          Now Watching
        </h1>
        <p className="mt-1 text-sm text-base-500">
          Shows you&apos;ve started but haven&apos;t finished, most recently watched first.
        </p>
      </motion.div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <ShowGridSkeleton count={5} progress />
      ) : watching.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-hairline bg-base-850/40 px-6 py-14 text-center">
          <div className="mb-3 text-4xl">📺</div>
          <p className="max-w-xs text-sm text-base-500">
            Nothing in progress. Mark an episode watched on any show and it&apos;ll show up here.
          </p>
          <Link
            to="/search"
            className="mt-4 rounded-lg border border-hairline-strong px-4 py-2 text-sm text-base-200 transition-colors duration-200 hover:border-accent-500/40 hover:text-accent-400"
          >
            Find a show
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {watching.map((s, i) => {
            const progress = seasonProgress.get(s.showId)
            const isMultiSeason = Boolean(progress && progress.segments.length > 1)
            const watchedNum = isMultiSeason ? progress!.currentSeasonWatched : s.watchedCount
            const totalNum = isMultiSeason ? progress!.currentSeasonTotal : s.totalEpisodes
            return (
              <motion.div
                key={s.showId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.02 }}
              >
                <Link to={`/show/${s.showId}`} className="group block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-base-800 ring-1 ring-hairline transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.35)]">
                    {s.showPosterPath ? (
                      <img
                        src={posterUrl(s.showPosterPath) ?? undefined}
                        alt={s.showName}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-base-400">
                        {s.showName}
                      </div>
                    )}
                    <StreamingBadge provider={platforms.get(s.showId)} />
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-base-100">{s.showName}</p>
                  <p className="text-xs text-base-400">
                    {isMultiSeason && `Season ${progress!.currentSeasonNumber} · `}
                    {watchedNum}
                    {totalNum ? `/${totalNum}` : ''}
                    {s.lastWatchedAt
                      ? ` · ${s.lastWatchedAtUnknown ? 'a while ago' : formatShortDate(s.lastWatchedAt)}`
                      : ''}
                  </p>
                  {nextEpisodes.get(s.showId) && (
                    <p className="text-[11px] text-accent-400">
                      New episode {formatShortDate(nextEpisodes.get(s.showId)!.airDate)}
                    </p>
                  )}
                  <div className="mt-1.5">
                    <SeasonProgressBar
                      segments={
                        progress?.segments ??
                        (s.totalEpisodes
                          ? [{ seasonNumber: 1, watched: s.watchedCount, total: s.totalEpisodes }]
                          : [])
                      }
                    />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Watchlist -- shows saved for later, right below what's in progress.
          History moved off Home entirely (still on Profile) -- removing a
          show from Now Watching is now handled from the show's own page
          (see ShowDetail.tsx), so it no longer needs a matching "finished"
          list here to explain where things went. */}
      {!loading && watchlist.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-base-100">Your Watchlist</h2>
            <Link to="/profile" className="text-xs font-medium text-accent-400 hover:underline">
              See all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {watchlist.map((w, i) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.02 }}
              >
                <Link to={`/show/${w.show_id}`} className="group block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-base-800 ring-1 ring-hairline transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.35)]">
                    {w.show_poster_path ? (
                      <img
                        src={posterUrl(w.show_poster_path) ?? undefined}
                        alt={w.show_name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-base-400">
                        {w.show_name}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-base-100">{w.show_name}</p>
                  <p className="text-xs text-base-400">Added {formatShortDate(w.added_at)}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recently in the group -- a taste of the full Activity feed, right on Home. */}
      {(loadingGroup || recentGroupActivity.length > 0) && (
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-base-100">Recently in the group</h2>
            <Link to="/activity" className="text-xs font-medium text-accent-400 hover:underline">
              See all &rarr;
            </Link>
          </div>
          {loadingGroup ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-base-850/70" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {recentGroupActivity.map((event) => (
                <ActivityRow key={event.key} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
