import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchRecentRatings } from '../lib/ratings'
import { posterUrl } from '../lib/tmdb'
import type { EpisodeRating } from '../types'

export default function Profile() {
  const { user, signOut } = useAuth()
  const [ratings, setRatings] = useState<EpisodeRating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchRecentRatings(user.id)
      .then((data) => {
        if (!cancelled) setRatings(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load ratings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const stats = useMemo(() => {
    const totalEpisodes = ratings.length
    const showIds = new Set(ratings.map((r) => r.show_id))
    const avg =
      totalEpisodes === 0
        ? null
        : ratings.reduce((sum, r) => sum + r.rating, 0) / totalEpisodes
    return { totalEpisodes, totalShows: showIds.size, avg }
  }, [ratings])

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-base-500">Signed in as</p>
          <h1 className="font-display text-lg font-semibold text-base-100 sm:text-xl">
            {user?.email}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-base-300 transition-colors duration-200 hover:border-red-500/40 hover:text-red-400"
        >
          Sign out
        </button>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="Episodes rated" value={stats.totalEpisodes} />
        <StatCard label="Shows" value={stats.totalShows} />
        <StatCard label="Avg rating" value={stats.avg !== null ? stats.avg.toFixed(1) : '—'} />
      </div>

      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-400">Diary</h2>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-base-850/70" />
          ))}
        </div>
      ) : ratings.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="mb-3 text-4xl">⭐</div>
          <p className="text-sm text-base-500">
            No ratings yet.{' '}
            <Link to="/search" className="text-accent-400 hover:underline">
              Find a show
            </Link>{' '}
            to get started.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {ratings.map((r, i) => (
            <motion.li
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.02 }}
            >
              <Link
                to={`/show/${r.show_id}`}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-base-850/60 p-2.5 transition-colors duration-200 hover:bg-base-800/70"
              >
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-base-800">
                  {r.show_poster_path && (
                    <img
                      src={posterUrl(r.show_poster_path, 'w185') ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-base-100">{r.show_name}</p>
                  <p className="text-xs text-base-400">
                    S{r.season_number} · E{r.episode_number}
                    {r.episode_name ? ` — ${r.episode_name}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-star">
                  {r.rating.toFixed(1)}
                  <StarGlyph />
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-base-850/60 p-3.5 text-center">
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
