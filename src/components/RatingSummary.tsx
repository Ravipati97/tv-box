import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import StarRating from './StarRating'

/** Minimal shape both ShowRatingWithUser and SeasonRatingWithUser satisfy --
 * this component doesn't care which kind of rating it's showing. */
interface RatingEntry {
  id: string
  user_id: string
  rating: number
  users: { username: string } | null
}

interface RatingSummaryProps {
  ratings: RatingEntry[]
  myRating: number
  onChange: (value: number) => void | Promise<void>
  saving?: boolean
  currentUserId?: string
  size?: 'sm' | 'md' | 'lg'
  emptyLabel?: string
}

/**
 * Star input + "here's what everyone else thought" -- shared by the show-
 * level rating and the per-season one, since both are exactly the same
 * interaction (rate it, see the crowd's average, expand to see who rated
 * what) just scoped to a different rating list.
 */
export default function RatingSummary({
  ratings,
  myRating,
  onChange,
  saving = false,
  currentUserId,
  size = 'md',
  emptyLabel = "You're the first to rate this",
}: RatingSummaryProps) {
  const [open, setOpen] = useState(false)
  const others = ratings.filter((r) => r.user_id !== currentUserId)
  const othersAvg = others.length > 0 ? others.reduce((sum, r) => sum + r.rating, 0) / others.length : null

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StarRating value={myRating} onChange={onChange} size={size} />
        {saving && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-base-600 border-t-accent-400" />
        )}
        {myRating > 0 && (
          // The star row itself supports clearing too (tap/click your
          // current rating again), but that's a hidden gesture nobody would
          // guess on their own -- this is the actual, visible way to undo a
          // rating.
          <button
            type="button"
            onClick={() => onChange(0)}
            disabled={saving}
            aria-label="Clear your rating"
            className="text-xs text-base-500 underline decoration-dotted underline-offset-2 transition-colors duration-150 hover:text-base-300 disabled:opacity-50"
          >
            Clear
          </button>
        )}
        {ratings.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-base-400 hover:text-base-200"
          >
            {othersAvg !== null ? (
              <>
                <StarGlyph />
                {othersAvg.toFixed(1)}
                <span className="text-base-500">
                  ({others.length} {others.length === 1 ? 'other rating' : 'other ratings'})
                </span>
              </>
            ) : (
              <span className="text-base-500">{emptyLabel}</span>
            )}
          </button>
        )}
      </div>

      {open && ratings.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2.5 max-w-xs space-y-1.5 border-t border-hairline pt-2.5"
        >
          {ratings
            .slice()
            .sort((a, b) => b.rating - a.rating)
            .map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs">
                {r.user_id === currentUserId ? (
                  <span className="text-base-300">You</span>
                ) : (
                  <Link to={`/u/${r.users?.username ?? ''}`} className="text-base-300 hover:text-accent-400">
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
  )
}

function StarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}
