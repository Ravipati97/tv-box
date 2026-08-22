import { useMemo } from 'react'
import type { ShowRating } from '../types'

const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const

/** Letterboxd-style rating histogram: one bar per half-star bucket (this
 * app's rating scale, see StarRating.tsx), tallest bar scaled to full
 * height so the shape of someone's ratings is visible at a glance. */
export default function RatingDistribution({ ratings }: { ratings: ShowRating[] }) {
  const counts = useMemo(() => {
    const c = new Array(BUCKETS.length).fill(0)
    for (const r of ratings) {
      const idx = BUCKETS.indexOf(r.rating as (typeof BUCKETS)[number])
      if (idx !== -1) c[idx]++
    }
    return c
  }, [ratings])

  if (ratings.length === 0) return null

  const max = Math.max(1, ...counts)

  return (
    <div className="mb-8">
      <div className="flex h-16 items-end gap-1">
        {BUCKETS.map((b, i) => (
          <div
            key={b}
            title={`${counts[i]} show${counts[i] === 1 ? '' : 's'} rated ${b.toFixed(1)}`}
            className="flex-1 rounded-t-sm bg-star/70 transition-[height] duration-300"
            // A count of 0 still gets a hairline sliver -- an empty bucket
            // reads as "zero," not as a rendering gap in the bar row.
            style={{ height: `${counts[i] === 0 ? 3 : Math.max(10, (counts[i] / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-base-500">
        <span className="flex items-center gap-1">
          <StarGlyph />
          0.5
        </span>
        <span className="flex items-center gap-1">
          <StarGlyph />
          5
        </span>
      </div>
    </div>
  )
}

function StarGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}
