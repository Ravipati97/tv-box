import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchRecentShowRatings } from '../lib/showRatings'
import { fetchRecentWatched } from '../lib/watched'
import { fetchRecentRewatches } from '../lib/rewatches'
import { summarizeShowActivity } from '../lib/showActivity'
import { availableRecapYears, buildYearRecap } from '../lib/recap'
import { posterUrl } from '../lib/tmdb'
import type { EpisodeWatched, ShowRating, ShowRewatch } from '../types'

export default function Recap() {
  const { user } = useAuth()
  const [ratings, setRatings] = useState<ShowRating[]>([])
  const [watched, setWatched] = useState<EpisodeWatched[]>([])
  const [rewatches, setRewatches] = useState<ShowRewatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRecentShowRatings(user.id, 5000),
      fetchRecentWatched(user.id, 5000),
      fetchRecentRewatches(user.id, 5000),
    ])
      .then(([r, w, rw]) => {
        if (cancelled) return
        setRatings(r)
        setWatched(w)
        setRewatches(rw)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load your recap.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const years = useMemo(() => availableRecapYears(ratings, watched, rewatches), [ratings, watched, rewatches])

  useEffect(() => {
    if (year === null && years.length > 0) setYear(years[0])
  }, [years, year])

  const activity = useMemo(() => summarizeShowActivity(ratings, watched), [ratings, watched])

  const recap = useMemo(() => {
    if (year === null) return null
    return buildYearRecap(year, activity, ratings, watched, rewatches)
  }, [year, activity, ratings, watched, rewatches])

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-xl font-semibold text-base-100 sm:text-2xl"
        >
          Your year in TV
        </motion.h1>
        {years.length > 1 && (
          <div className="flex gap-1.5">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  year === y
                    ? 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40'
                    : 'text-base-400 hover:bg-hover hover:text-base-200'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-base-850/70" />
          ))}
        </div>
      ) : error || !recap || years.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-hairline bg-base-850/40 px-6 py-14 text-center">
          <div className="mb-3 text-4xl">{error ? '⚠️' : '🎬'}</div>
          <p className="max-w-xs text-sm text-base-500">
            {error ?? (
              <>
                Nothing tracked yet.{' '}
                <Link to="/search" className="text-accent-400 hover:underline">
                  Find a show
                </Link>{' '}
                to get started.
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Shows finished" value={recap.showsFinished} />
            <StatCard label="Episodes watched" value={recap.episodesWatched} />
            <StatCard label="Hours watched" value={recap.hoursWatched} />
            <StatCard label="Ratings given" value={recap.ratingsGiven} />
            <StatCard label="Avg rating" value={recap.avgRating !== null ? recap.avgRating.toFixed(1) : '—'} />
            <StatCard label="Rewatches" value={recap.rewatches} />
          </div>

          {recap.mostActiveMonth && (
            <p className="mt-4 text-sm text-base-400">
              Busiest month: <span className="text-base-200">{recap.mostActiveMonth}</span>
            </p>
          )}

          {recap.topRated && (
            <div className="mt-8">
              <h2 className="font-display mb-3 text-sm font-semibold uppercase tracking-wide text-base-400">
                Top rated
              </h2>
              <Link
                to={`/show/${recap.topRated.showId}`}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-base-850/60 p-2.5 transition-colors duration-200 hover:bg-base-800/70"
              >
                <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-base-800">
                  {recap.topRated.showPosterPath && (
                    <img
                      src={posterUrl(recap.topRated.showPosterPath, 'w185') ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-base-100">{recap.topRated.showName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-star">
                  {recap.topRated.rating.toFixed(1)}
                  <StarGlyph />
                </div>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-hairline bg-base-850/60 p-3.5 text-center">
      <p className="text-lg font-semibold text-base-100 sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-base-500">{label}</p>
    </div>
  )
}

function StarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}
