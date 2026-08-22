import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchShowRating } from '../lib/showRatings'
import { fetchWatchedForUserAndShow } from '../lib/watched'
import { fetchRewatchesForShow } from '../lib/rewatches'
import { fetchUserByUsername } from '../lib/users'
import { posterUrl } from '../lib/tmdb'
import { formatShortDate } from '../lib/date'
import CenteredMessage from '../components/CenteredMessage'
import type { AppUser, EpisodeWatched, ShowRating, ShowRewatch } from '../types'

export default function ShowDiary() {
  const { username, showId } = useParams<{ username: string; showId: string }>()
  const { user: me } = useAuth()
  const showIdNum = Number(showId)

  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined)
  const [rating, setRating] = useState<ShowRating | null>(null)
  const [watched, setWatched] = useState<EpisodeWatched[]>([])
  const [rewatches, setRewatches] = useState<ShowRewatch[]>([])
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
          const [ratingRow, watchedRows, rewatchRows] = await Promise.all([
            fetchShowRating(found.id, showIdNum),
            fetchWatchedForUserAndShow(found.id, showIdNum),
            fetchRewatchesForShow(found.id, showIdNum),
          ])
          if (!cancelled) {
            setRating(ratingRow)
            setWatched(watchedRows)
            setRewatches(rewatchRows)
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load this show.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [username, showIdNum])

  if (profile === null) {
    return <CenteredMessage message={`No one found with username “${username}”.`} />
  }

  const isMe = me?.username === username
  const showName = rating?.show_name ?? watched[0]?.show_name
  const posterPath = rating?.show_poster_path ?? watched[0]?.show_poster_path
  const hasNothing = !loading && !rating && watched.length === 0

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
      ) : hasNothing ? (
        <p className="mt-10 text-center text-sm text-base-500">
          {error ?? 'No activity for this show yet.'}
        </p>
      ) : (
        <>
          <div className="mb-8 flex items-center gap-4">
            <div className="w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-hairline-strong">
              {posterPath ? (
                <img
                  src={posterUrl(posterPath) ?? undefined}
                  alt=""
                  decoding="async"
                  className="w-full"
                />
              ) : (
                <div className="aspect-[2/3] w-full bg-base-800" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold text-base-100 sm:text-xl">
                {showName}
              </h1>
              <p className="flex items-center gap-2 text-xs text-base-400">
                {rating ? (
                  <span className="flex items-center gap-1 text-star">
                    {rating.rating.toFixed(1)}
                    <StarGlyph />
                  </span>
                ) : (
                  <span>{isMe ? "You haven't" : "Hasn't"} rated this yet</span>
                )}
                {watched.length > 0 && (
                  <span>
                    · {watched.length} {watched.length === 1 ? 'episode' : 'episodes'} watched
                  </span>
                )}
                {rewatches.length > 0 && (
                  <span>
                    · rewatched {rewatches.length} {rewatches.length === 1 ? 'time' : 'times'}
                  </span>
                )}
              </p>
              <Link
                to={`/show/${showIdNum}`}
                className="mt-1.5 inline-block text-xs text-accent-400 hover:underline"
              >
                Open show page &rarr;
              </Link>
            </div>
          </div>

          {rewatches.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-base-400">Rewatches</h2>
              <ul className="flex flex-wrap gap-1.5">
                {rewatches.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-full bg-hover-strong px-2.5 py-1 text-xs text-base-300"
                  >
                    {formatShortDate(r.rewatched_at)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {watched.length > 0 && (
            <>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-base-400">
                Watched, most recent first
              </h2>
              <ul className="space-y-2">
                {watched.map((w, i) => (
                  <motion.li
                    key={w.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}
                    className="flex items-center justify-between rounded-xl border border-hairline bg-base-850/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-base-100">
                        S{w.season_number} · E{w.episode_number}
                        {w.episode_name ? ` — ${w.episode_name}` : ''}
                      </p>
                      <p className="text-xs text-base-500">
                        {w.watched_at_unknown ? 'Watched a while ago' : formatShortDate(w.watched_at)}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </>
          )}
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
