import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { HistorySort, ShowActivity } from '../lib/showActivity'
import { sortHistory } from '../lib/showActivity'
import {
  buildHistoryFilterFacets,
  countActiveHistoryFilters,
  emptyHistoryFilters,
  filterHistory,
  isHistoryFiltersActive,
} from '../lib/historyFilters'
import type { HistoryFilters } from '../lib/historyFilters'
import { posterUrl, providerLogoUrl } from '../lib/tmdb'
import type { ResolvedProvider } from '../lib/streamingProvider'
import { useStreamingPlatforms } from '../hooks/useStreamingPlatforms'
import { useShowDetails } from '../hooks/useShowDetails'
import HistoryFiltersPanel from './HistoryFiltersPanel'
import StreamingBadge from './StreamingBadge'
import EmptyState from './EmptyState'
import { formatShortDate } from '../lib/date'

const SORT_LABELS: Record<HistorySort, string> = {
  recent: 'Recent',
  rating: 'Top rated',
  finished: 'Finished',
  name: 'A–Z',
  platform: 'Platform',
}

const NOT_STREAMING_LABEL = 'Not free to stream'

interface HistorySectionProps {
  activity: ShowActivity[]
  /** Whose history this is, for building /u/:username/shows/:showId links. */
  username: string
  emptyIcon?: string
  emptyMessage: string
  /** Default sort -- lets Home start on "Recent" while a profile's History
   * tab can do the same without every caller repeating the default. */
  defaultSort?: HistorySort
}

export default function HistorySection({
  activity,
  username,
  emptyIcon = '✅',
  emptyMessage,
  defaultSort = 'recent',
}: HistorySectionProps) {
  const [sort, setSort] = useState<HistorySort>(defaultSort)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<HistoryFilters>(emptyHistoryFilters)

  const showIds = useMemo(() => activity.map((s) => s.showId), [activity])
  // Resolved unconditionally (not just for the "Platform" sort) -- every
  // card gets a streaming badge regardless of how the grid's currently sorted.
  const { platforms, loading: loadingPlatforms } = useStreamingPlatforms(showIds)
  // Genre/year/country/language/status all come from TMDB show details,
  // which nothing else on this list needs -- only fetched once someone
  // actually opens Filters (or already has one active), not on every visit.
  const detailsEnabled = filtersOpen || isHistoryFiltersActive(filters)
  const { details, loading: loadingDetails } = useShowDetails(showIds, detailsEnabled)

  const facets = useMemo(
    () => buildHistoryFilterFacets(activity, details, platforms),
    [activity, details, platforms],
  )
  const filteredActivity = useMemo(
    () => filterHistory(activity, filters, details, platforms),
    [activity, filters, details, platforms],
  )

  const flatSorted = useMemo(
    () => (sort === 'platform' ? [] : sortHistory(filteredActivity, sort)),
    [filteredActivity, sort],
  )

  const groupedByPlatform = useMemo(() => {
    if (sort !== 'platform') return null
    const groups = new Map<string, { provider: ResolvedProvider | null; shows: ShowActivity[] }>()
    for (const s of filteredActivity) {
      const provider = platforms.get(s.showId) ?? null
      const key = provider ? provider.provider_name : NOT_STREAMING_LABEL
      let group = groups.get(key)
      if (!group) {
        group = { provider, shows: [] }
        groups.set(key, group)
      }
      group.shows.push(s)
    }
    return Array.from(groups.entries())
      .map(([name, g]) => ({ name, ...g }))
      .sort((a, b) => {
        if (a.name === NOT_STREAMING_LABEL) return 1
        if (b.name === NOT_STREAMING_LABEL) return -1
        return a.name.localeCompare(b.name)
      })
  }, [sort, platforms, filteredActivity])

  if (activity.length === 0) {
    return (
      <EmptyState icon={emptyIcon}>
        <p className="max-w-xs text-sm text-base-500">{emptyMessage}</p>
      </EmptyState>
    )
  }

  const activeFilterCount = countActiveHistoryFilters(filters)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(SORT_LABELS) as HistorySort[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                sort === key
                  ? 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40'
                  : 'text-base-500 hover:bg-hover hover:text-base-200'
              }`}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
            filtersOpen || activeFilterCount > 0
              ? 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40'
              : 'text-base-500 hover:bg-hover hover:text-base-200'
          }`}
        >
          Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
        </button>
      </div>

      {filtersOpen && (
        <HistoryFiltersPanel
          facets={facets}
          filters={filters}
          onChange={setFilters}
          loadingDetails={loadingDetails}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {filteredActivity.length === 0 ? (
        <EmptyState icon="🔍" className="mt-4">
          <p className="max-w-xs text-sm text-base-500">No shows match these filters.</p>
          <button
            type="button"
            onClick={() => setFilters(emptyHistoryFilters())}
            className="mt-3 text-xs text-accent-400 hover:underline"
          >
            Clear filters
          </button>
        </EmptyState>
      ) : sort === 'platform' ? (
        loadingPlatforms && platforms.size === 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[2/3] rounded-2xl bg-base-800" />
                <div className="mt-2 h-3.5 w-3/4 rounded bg-base-800" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {groupedByPlatform?.map((group) => (
              <div key={group.name}>
                <div className="mb-3 flex items-center gap-2">
                  {group.provider && providerLogoUrl(group.provider.logo_path) && (
                    <div className="h-6 w-6 shrink-0 overflow-hidden rounded ring-1 ring-hairline-strong">
                      <img
                        src={providerLogoUrl(group.provider.logo_path) ?? undefined}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-500">
                    {group.name} <span className="text-base-600">· {group.shows.length}</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {group.shows.map((s, i) => (
                    <HistoryCard
                      key={s.showId}
                      show={s}
                      username={username}
                      index={i}
                      provider={platforms.get(s.showId)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {flatSorted.map((s, i) => (
            <HistoryCard key={s.showId} show={s} username={username} index={i} provider={platforms.get(s.showId)} />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryCard({
  show: s,
  username,
  index,
  provider,
}: {
  show: ShowActivity
  username: string
  index: number
  provider?: ResolvedProvider | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.02 }}
    >
      <Link to={`/u/${username}/shows/${s.showId}`} className="group block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-base-800 ring-1 ring-hairline transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.35)]">
          {s.showPosterPath ? (
            <img
              src={posterUrl(s.showPosterPath) ?? undefined}
              alt={s.showName}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-base-400">
              {s.showName}
            </div>
          )}
          <StreamingBadge provider={provider} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4">
            {s.rating !== null ? (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-star">
                {s.rating.toFixed(1)}
                <StarGlyph />
              </div>
            ) : (
              <div className="text-[11px] font-semibold text-accent-400">Finished</div>
            )}
          </div>
        </div>
        <p className="mt-2 truncate text-sm font-medium text-base-100">{s.showName}</p>
        <p className="text-xs text-base-400">
          {s.finishedAt
            ? s.finishedAtUnknown
              ? 'Watched a while ago'
              : formatShortDate(s.finishedAt)
            : s.ratedAt
              ? formatShortDate(s.ratedAt)
              : ''}
        </p>
      </Link>
    </motion.div>
  )
}

function StarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}
