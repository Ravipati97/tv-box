import { useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
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

// How far a pointer has to move before a press counts as a drag rather than
// a plain tap/click -- keeps an ordinary click from being treated as a
// (no-op, same-spot) drag.
const DRAG_THRESHOLD_PX = 6

function Star({ fill, px }: { fill: number; px: number }) {
  // fill: 0, 0.5, or 1
  // useId (not Math.random()) -- stable across re-renders and guaranteed
  // unique even with several StarRating instances on screen at once (e.g.
  // ShowDetail's show + season ratings, both mounted simultaneously).
  const clipId = useId()
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
  const containerRef = useRef<HTMLDivElement>(null)
  // Tracks an in-progress press across the whole row (not per-star) so a
  // drag can be dragged. Ref, not state -- read/written inside the same
  // pointer-event sequence, doesn't need to trigger a re-render itself.
  const dragRef = useRef<{ pointerId: number; startX: number; dragging: boolean } | null>(null)
  const px = SIZE_MAP[size]
  const displayValue = hoverValue ?? value
  const interactive = !readOnly && Boolean(onChange)

  function valueFromClientX(clientX: number): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return value
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    // 5 stars, half-star steps -> 10 slots across the row's width.
    return Math.max(0.5, Math.min(5, Math.round(ratio * 10) / 2))
  }

  function handlePick(starIndex: number, half: boolean) {
    if (!interactive || !onChange) return
    const picked = half ? starIndex - 0.5 : starIndex
    // Picking the exact same rating again clears it (toggle off) -- also
    // reachable via the explicit "Clear" control in RatingSummary, this is
    // just the quicker shortcut once you know it's there.
    onChange(picked === value ? 0 : picked)
  }

  // A precise first tap on a ~10px-wide half-star zone is genuinely hard to
  // land on a phone. Letting a press drag across the whole row -- watching
  // the preview update live and only committing on release -- turns "land
  // exactly right the first time" into "get close, then adjust," which is
  // far more forgiving on touch. Plain taps/clicks are untouched (each
  // half-star button's own onClick above still handles those); this only
  // takes over once real movement is detected, and capturing the pointer at
  // that point redirects its eventual pointerup/click away from whatever
  // button is underneath -- so the two paths can never both fire for the
  // same gesture.
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive) return
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, dragging: false }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!interactive || !drag || drag.pointerId !== e.pointerId) return
    if (!drag.dragging) {
      if (Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD_PX) return
      drag.dragging = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setHoverValue(valueFromClientX(e.clientX))
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!interactive || !drag || drag.pointerId !== e.pointerId || !drag.dragging || !onChange) return
    const picked = valueFromClientX(e.clientX)
    onChange(picked === value ? 0 : picked)
    setHoverValue(null)
  }

  function handlePointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
    setHoverValue(null)
  }

  return (
    <div
      ref={containerRef}
      // py-2.5/-my-2.5 pads the actual touch/click/drag target well past the
      // visible icon size (WCAG/HIG/Material all call for ~44px minimum)
      // without the extra padding pushing surrounding layout around -- the
      // matching negative margin cancels it back out to the same footprint.
      // touch-pan-y tells the browser to keep handling vertical scroll
      // gestures natively and only hand horizontal movement to the drag
      // logic below -- without it, starting a scroll with a finger that
      // happens to land on the star row would get hijacked into a rating
      // drag instead of scrolling the page.
      className={`inline-flex touch-pan-y items-center gap-[3px] py-2.5 -my-2.5 ${className}`}
      onMouseLeave={() => {
        if (!dragRef.current?.dragging) setHoverValue(null)
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
