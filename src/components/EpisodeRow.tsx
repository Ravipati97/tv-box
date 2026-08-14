import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import StarRating from './StarRating'
import { stillUrl } from '../lib/tmdb'
import type { EpisodeRatingWithUser, TmdbEpisode } from '../types'

interface EpisodeRowProps {
  episode: TmdbEpisode
  rating: number
  crowd: EpisodeRatingWithUser[]
  myUserId: string
  onRate: (rating: number) => Promise<void>
}

export default function EpisodeRow({ episode, rating, crowd, myUserId, onRate }: EpisodeRowProps) {
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showCrowd, setShowCrowd] = useState(false)
  const still = stillUrl(episode.still_path)

  const others = crowd.filter((r) => r.user_id !== myUserId)
  const othersAvg =
    others.length > 0 ? others.reduce((sum, r) => sum + r.rating, 0) / others.length : null

  async function handleChange(value: number) {
    setSaving(true)
    try {
      await onRate(value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`group rounded-xl border border-white/5 bg-base-850/60 p-3 transition-colors duration-200 hover:bg-base-800/70 sm:p-4 ${
        rating > 0 ? 'ring-1 ring-inset ring-accent-500/20' : ''
      }`}
    >
      <div className="flex gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-base-800 sm:w-40"
        >
          {still ? (
            <img src={still} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-base-500">
              No image
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-400">
                Episode {episode.episode_number}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-left text-sm font-medium text-base-100 sm:text-base"
              >
                {episode.name || `Episode ${episode.episode_number}`}
              </button>
            </div>
            {episode.runtime ? (
              <span className="shrink-0 text-xs text-base-500">{episode.runtime}m</span>
            ) : null}
          </div>

          <p
            className={`mt-1 text-xs text-base-400 sm:text-sm ${expanded ? '' : 'line-clamp-2'}`}
          >
            {episode.overview || 'No synopsis available.'}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:mt-3">
            <StarRating value={rating} onChange={handleChange} size="sm" />
            {saving && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-base-600 border-t-accent-400" />
            )}
            {othersAvg !== null && (
              <button
                type="button"
                onClick={() => setShowCrowd((v) => !v)}
                className="flex items-center gap-1 text-xs text-base-400 hover:text-base-200"
              >
                <StarGlyph />
                {othersAvg.toFixed(1)}
                <span className="text-base-500">
                  ({others.length} {others.length === 1 ? 'other rating' : 'other ratings'})
                </span>
              </button>
            )}
          </div>

          {showCrowd && crowd.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 space-y-1 border-t border-white/5 pt-2"
            >
              {crowd
                .slice()
                .sort((a, b) => b.rating - a.rating)
                .map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    {r.user_id === myUserId ? (
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
      </div>
    </motion.div>
  )
}

function StarGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}
