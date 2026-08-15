import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ShowCard from '../components/ShowCard'
import { ShowGridSkeleton } from '../components/Skeletons'
import { searchShows, isTmdbConfigured } from '../lib/tmdb'
import type { TmdbShowSummary } from '../types'

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbShowSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setHasSearched(false)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const id = ++requestId.current
      try {
        const shows = await searchShows(trimmed)
        if (id === requestId.current) {
          setResults(shows)
          setError(null)
        }
      } catch (err) {
        if (id === requestId.current) {
          setError(err instanceof Error ? err.message : 'Search failed.')
          setResults([])
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false)
          setHasSearched(true)
        }
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display mb-5 text-2xl font-semibold text-base-100"
      >
        Find a show
      </motion.h1>

      <div className="relative mb-6">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base-500"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a TV show…"
          className="w-full rounded-xl border border-hairline-strong bg-base-850 py-3 pl-10 pr-4 text-base text-base-100 placeholder:text-base-500 transition-all duration-200 focus:border-accent-500/60 focus:ring-4 focus:ring-accent-500/10 sm:text-sm"
        />
      </div>

      {!isTmdbConfigured && (
        <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          TMDB isn&apos;t configured yet. Set VITE_TMDB_API_KEY (see README) to enable search.
        </div>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading && <ShowGridSkeleton />}

      {!loading && (
        <AnimatePresence mode="popLayout">
          {results.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              {results
                .filter((s) => s.poster_path)
                .map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
            </motion.div>
          ) : hasSearched && !error ? (
            <div className="mt-14 flex flex-col items-center rounded-2xl border border-hairline bg-base-850/40 px-6 py-14 text-center">
              <div className="mb-3 text-4xl">🔍</div>
              <p className="text-sm text-base-500">
                No shows found for &ldquo;{query}&rdquo;.
              </p>
            </div>
          ) : !query.trim() ? (
            <div className="mt-14 flex flex-col items-center rounded-2xl border border-hairline bg-base-850/40 px-6 py-14 text-center">
              <div className="mb-3 text-4xl">📺</div>
              <p className="text-sm text-base-500">
                Search for any TV show to start rating episodes.
              </p>
            </div>
          ) : null}
        </AnimatePresence>
      )}
    </div>
  )
}
