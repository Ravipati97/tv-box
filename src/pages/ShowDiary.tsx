import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchRatingsForUserAndShow } from '../lib/ratings'
import { fetchUserByUsername } from '../lib/users'
import { posterUrl } from '../lib/tmdb'
import { formatShortDate } from '../lib/date'
import type { AppUser, EpisodeRating } from '../types'

export default function ShowDiary() {
  const { username, showId } = useParams<{ username: string; showId: string }>()
  const { user: me } = useAuth()
  const showIdNum = Number(showId)

  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined)
  const [ratings, setRatings] = useState<EpisodeRating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username || Number.isNaN(showIdNum)) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchUserByUsername(username)
      .then(async (found) => {
        if (cancelled) return
        setProfile(found)
        if (found) {
          const data = await fetchRatingsForUserAndShow(found.id, showIdNum)
          if (!cancelled) setRatings(data)
        }
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
  }, [username, showIdNum])

  if (profile === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 text-center sm:px-6">
        <p className="text-sm text-base-500">No member found with username “{username}”.</p>
        <Link to="/members" className="mt-3 inline-block text-sm text-accent-400 hover:underline">
          &larr; Back to members
        </Link>
      </div>
    )
  }

  const isMe = me?.username === username
  const first = ratings[0]
  const avg =
    ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : null

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <Link
        to={`/u/${username}`}
        className="mb-4 inline-block text-xs text-base-500 hover:text-base-300"
      >
        &larr; {isMe ? 'Your' : `@${username}'s`} shows
      </Link>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="flex gap-3">
            <div className="h-24 w-16 rounded-lg bg-base-800" />
            <div className="space-y-2 pt-1">
              <div className="h-5 w-40 rounded bg-base-800" />
              <div className="h-3 w-24 rounded bg-base-800" />
            </div>
          </div>
        </div>
      ) : ratings.length === 0 ? (
        <p className="mt-10 text-center text-sm text-base-500">
          {error ?? 'No ratings for this show yet.'}
        </p>
      ) : (
        <>
          <div className="mb-8 flex items-center gap-4">
            <div className="w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
              {first.show_poster_path ? (
                <img src={posterUrl(first.show_poster_path) ?? undefined} alt="" className="w-full" />
              ) : (
                <div className="aspect-[2/3] w-full bg-base-800" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold text-base-100 sm:text-xl">
                {first.show_name}
              </h1>
              <p className="text-xs text-base-400">
                {isMe ? 'You' : `@${username}`} rated {ratings.length}{' '}
                {ratings.length === 1 ? 'episode' : 'episodes'}
                {avg !== null ? ` · ${avg.toFixed(1)} avg` : ''}
              </p>
              <Link
                to={`/show/${showIdNum}`}
                className="mt-1.5 inline-block text-xs text-accent-400 hover:underline"
              >
                Open show page &rarr;
              </Link>
            </div>
          </div>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-base-400">
            Rated, most recent first
          </h2>
          <ul className="space-y-2">
            {ratings.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-base-850/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-base-100">
                    S{r.season_number} · E{r.episode_number}
                    {r.episode_name ? ` — ${r.episode_name}` : ''}
                  </p>
                  <p className="text-xs text-base-500">{formatShortDate(r.rated_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-star">
                  {r.rating.toFixed(1)}
                  <StarGlyph />
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}
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
