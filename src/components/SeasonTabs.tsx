import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { TmdbSeasonSummary } from '../types'

interface SeasonTabsProps {
  seasons: TmdbSeasonSummary[]
  active: number
  onSelect: (seasonNumber: number) => void
}

export default function SeasonTabs({ seasons, active, onSelect }: SeasonTabsProps) {
  const real = seasons.filter((s) => s.season_number > 0 || seasons.length === 1)
  const activeRef = useRef<HTMLButtonElement>(null)

  // This row scrolls horizontally on narrow screens (4+ seasons rarely all
  // fit), but nothing scrolled the selected tab into view -- landing
  // straight on Season 4 of a show you're mid-watching left it clipped at
  // the edge with no hint the row was even scrollable. block: 'nearest'
  // keeps this from also trying to scroll the page vertically.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [active])

  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {real.map((season) => {
        const isActive = season.season_number === active
        return (
          <button
            key={season.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            onClick={() => onSelect(season.season_number)}
            className="relative shrink-0 px-3.5 py-1.5 text-sm font-medium transition-colors duration-200"
          >
            {isActive && (
              <motion.span
                layoutId="season-pill"
                className="absolute inset-0 rounded-full bg-accent-500/15 ring-1 ring-accent-500/40"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className={`relative ${isActive ? 'text-accent-300' : 'text-base-400'}`}>
              {season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`}
            </span>
          </button>
        )
      })}
    </div>
  )
}
