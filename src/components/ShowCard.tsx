import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { posterUrl, yearFromDate } from '../lib/tmdb'
import type { TmdbShowSummary } from '../types'

export default function ShowCard({ show }: { show: TmdbShowSummary }) {
  const poster = posterUrl(show.poster_path)
  const year = yearFromDate(show.first_air_date)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/show/${show.id}`}
        className="group block"
        aria-label={`${show.name}${year ? ` (${year})` : ''}`}
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-base-800 ring-1 ring-white/5 transition-shadow duration-300 group-hover:shadow-[0_8px_30px_rgba(139,92,246,0.25)]">
          {poster ? (
            <img
              src={poster}
              alt={show.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-base-400">
              {show.name}
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
        <p className="mt-2 truncate text-sm font-medium text-base-100">{show.name}</p>
        {year && <p className="text-xs text-base-400">{year}</p>}
      </Link>
    </motion.div>
  )
}
