import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchRecentShowRatings, fetchRecentShowRatingsAllUsers } from '../lib/showRatings'
import { fetchRecentWatched, fetchRecentWatchedAllUsers } from '../lib/watched'
import { summarizeShowActivity, nowWatching, watchHistory, buildGroupActivity } from '../lib/showActivity'
import type { GroupActivityEvent } from '../lib/showActivity'
import { posterUrl } from '../lib/tmdb'
import { formatShortDate } from '../lib/date'
import HistorySection from '../components/HistorySection'
import ActivityRow from '../components/ActivityRow'
import type { EpisodeWatched, ShowRating } from '../types'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [groupActivity, setGroupActivity] = useState<GroupActivityEvent[]>([])
  const [loadingGroup, setLoadingGroup] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchRecentShowRatings(user.id, 2000), fetchRecentWatched(user.id, 2000)])
      .then(([ratingRows, watchedRows]) => {
        if (!cancelled) {
          setRatings(ratingRows)
          setWatched(watchedRows)
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
    Promise.all([fetchRecentShowRatingsAllUsers(150), fetchRecentWatchedAllUsers(400)])
      .then(([ratingRows, watchedRows]) => {
        if (!cancelled) setGroupActivity(buildGroupActivity(ratingRows, watchedRows))
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

  const activity = useMemo(() => summarizeShowActivity(ratings, watched), [ratings, watched])
  const watching = useMemo(() => nowWatching(activity), [activity])
  const history = useMemo(() => watchHistory(activity), [activity])
  const recentGroupActivity = groupActivity.slice(0, 5)

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
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] rounded-2xl bg-base-800" />
              <div className="mt-2 h-3.5 w-3/4 rounded bg-base-800" />
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-base-800" />
            </div>
          ))}
        </div>
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
            const pct =
              s.totalEpisodes && s.totalEpisodes > 0
                ? Math.min(100, (s.watchedCount / s.totalEpisodes) * 100)
                : null
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
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-base-100">{s.showName}</p>
                  <p className="text-xs text-base-400">
                    {s.watchedCount}
                    {s.totalEpisodes ? `/${s.totalEpisodes}` : ''} watched
                    {s.lastWatchedAt
                      ? ` · ${s.lastWatchedAtUnknown ? 'a while ago' : formatShortDate(s.lastWatchedAt)}`
                      : ''}
                  </p>
                  {pct !== null && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-base-800">
                      <div
                        className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* History -- everything finished or rated, right below what's in progress. */}
      {!loading && history.length > 0 && (
        <div className="mt-12">
          <h2 className="font-display mb-4 text-lg font-semibold text-base-100">Your History</h2>
          <HistorySection
            activity={history}
            username={user?.username ?? ''}
            emptyMessage="Nothing finished yet."
          />
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
