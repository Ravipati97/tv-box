import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchRecentShowRatings } from '../lib/showRatings'
import { fetchRecentWatched } from '../lib/watched'
import { summarizeShowActivity, nowWatching } from '../lib/showActivity'
import { posterUrl } from '../lib/tmdb'
import { formatShortDate } from '../lib/date'
import type { EpisodeWatched, ShowRating } from '../types'

export default function Home() {
  const { user } = useAuth()
  const [ratings, setRatings] = useState<ShowRating[]>([])
  const [watched, setWatched] = useState<EpisodeWatched[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const watching = useMemo(
    () => nowWatching(summarizeShowActivity(ratings, watched)),
    [ratings, watched],
  )

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-base-100 sm:text-2xl">
          Now Watching
        </h1>
        <p className="mt-1 text-sm text-base-500">
          Shows you've started but haven't finished, most recently watched first.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] rounded-xl bg-base-800" />
              <div className="mt-2 h-3.5 w-3/4 rounded bg-base-800" />
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-base-800" />
            </div>
          ))}
        </div>
      ) : watching.length === 0 ? (
        <div className="mt-14 flex flex-col items-center text-center">
          <div className="mb-3 text-4xl">📺</div>
          <p className="text-sm text-base-500">
            Nothing in progress. Mark an episode watched on any show and it'll show up here.
          </p>
          <Link
            to="/search"
            className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-base-200 transition-colors duration-200 hover:border-accent-500/40 hover:text-accent-400"
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
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-base-800 ring-1 ring-white/5 transition-shadow duration-300 group-hover:shadow-[0_8px_30px_rgba(139,92,246,0.25)]">
                    {s.showPosterPath ? (
                      <img
                        src={posterUrl(s.showPosterPath) ?? undefined}
                        alt={s.showName}
                        loading="lazy"
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
                    {s.lastWatchedAt ? ` · ${formatShortDate(s.lastWatchedAt)}` : ''}
                  </p>
                  {pct !== null && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-base-800">
                      <div
                        className="h-full rounded-full bg-accent-500"
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
    </div>
  )
}
