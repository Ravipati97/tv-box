import { useState } from 'react'
import { motion } from 'framer-motion'

interface StarRatingProps {
  /** Rating from 0 to 5, in 0.5 increments. 0 means unrated. */
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  readOnly?: boolean
  className?: string
}

const SIZE_MAP: Record<NonNullable<StarRatingProps['size']>, number> = {
  sm: 15,
  md: 20,
  lg: 28,
}

function Star({ fill, px }: { fill: number; px: number }) {
  // fill: 0, 0.5, or 1
  const clipId = `star-clip-${px}-${fill}-${Math.random().toString(36).slice(2, 8)}`
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" className="pointer-events-none block">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>
      <path
        d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z"
        fill="none"
        stroke="var(--color-base-600)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {fill > 0 && (
        <path
          d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z"
          fill="var(--color-star)"
          stroke="var(--color-star)"
          strokeWidth="1.4"
          strokeLinejoin="round"
          clipPath={`url(#${clipId})`}
        />
      )}
    </svg>
  )
}

export default function StarRating({
  value,
  onChange,
  size = 'md',
  readOnly = false,
  className = '',
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const px = SIZE_MAP[size]
  const displayValue = hoverValue ?? value
  const interactive = !readOnly && Boolean(onChange)

  function handlePick(starIndex: number, half: boolean) {
    if (!interactive || !onChange) return
    const picked = half ? starIndex - 0.5 : starIndex
    // Clicking the exact same rating again clears it (toggle off).
    onChange(picked === value ? 0 : picked)
  }

  return (
    <div
      className={`inline-flex items-center gap-[3px] ${className}`}
      onMouseLeave={() => setHoverValue(null)}
      role={interactive ? 'radiogroup' : undefined}
      aria-label={interactive ? 'Rate this episode' : `Rated ${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillForStar = Math.max(0, Math.min(1, displayValue - (starIndex - 1)))
        return (
          <motion.div
            key={starIndex}
            className="relative"
            whileHover={interactive ? { scale: 1.18 } : undefined}
            whileTap={interactive ? { scale: 0.92 } : undefined}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          >
            <Star fill={fillForStar} px={px} />
            {interactive && (
              <span className="absolute inset-0 flex">
                <button
                  type="button"
                  aria-label={`${starIndex - 0.5} stars`}
                  className="h-full w-1/2 cursor-pointer"
                  onMouseEnter={() => setHoverValue(starIndex - 0.5)}
                  onFocus={() => setHoverValue(starIndex - 0.5)}
                  onClick={() => handlePick(starIndex, true)}
                />
                <button
                  type="button"
                  aria-label={`${starIndex} stars`}
                  className="h-full w-1/2 cursor-pointer"
                  onMouseEnter={() => setHoverValue(starIndex)}
                  onFocus={() => setHoverValue(starIndex)}
                  onClick={() => handlePick(starIndex, false)}
                />
              </span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
