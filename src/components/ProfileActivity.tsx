import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchRecentShowRatings } from '../lib/showRatings'
import { fetchRecentWatched } from '../lib/watched'
import { summarizeShowActivity, watchHistory, sortHistory } from '../lib/showActivity'
import type { HistorySort } from '../lib/showActivity'
import { posterUrl } from '../lib/tmdb'
import { dayKey, formatDiaryHeading, formatShortDate } from '../lib/date'
import type { EpisodeWatched, ShowRating } from '../types'

interface ProfileActivityProps {
  userId: string
  username: string
}

interface DiaryGroup {
  heading: string
  items: ShowRating[]
}

type Tab = 'diary' | 'history'

const SORT_LABELS: Record<HistorySort, string> = {
  recent: 'Recent',
  rating: 'Top rated',
  name: 'A–Z',
}

export default function ProfileActivity({ userId, username }: ProfileActivityProps) {
  const [tab, setTab] = useState<Tab>('diary')
  const [sort, setSort] = useState<HistorySort>('recent')
  const [ratings, setRatings] = useState<ShowRating[]>([])
  const [watched, setWatched] = useState<EpisodeWatched[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchRecentShowRatings(userId, 2000), fetchRecentWatched(userId, 2000)])
      .then(([ratingRows, watchedRows]) => {
        if (!cancelled) {
          setRatings(ratingRows)
          setWatched(watchedRows)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load activity.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const activity = useMemo(() => summarizeShowActivity(ratings, watched), [ratings, watched])

  const stats = useMemo(() => {
    const totalShows = ratings.length
    const finished = activity.filter((s) => s.finished).length
    const avg = totalShows === 0 ? null : ratings.reduce((sum, r) => sum + r.rating, 0) / totalShows
    return { totalShows, finished, episodesWatched: watched.length, avg }
  }, [ratings, watched, activity])

  // Ratings already arrive sorted newest-first, so grouping is just "start a
  // new bucket whenever the calendar day changes".
  const diaryGroups = useMemo<DiaryGroup[]>(() => {
    const groups: DiaryGroup[] = []
    let currentKey = ''
    for (const r of ratings) {
      const key = dayKey(r.rated_at)
      if (key !== currentKey) {
        groups.push({ heading: formatDiaryHeading(r.rated_at), items: [r] })
        currentKey = key
      } else {
        groups[groups.length - 1].items.push(r)
      }
    }
    return groups
  }, [ratings])

  const history = useMemo(() => sortHistory(watchHistory(activity), sort), [activity, sort])

  return (
    <div>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Shows rated" value={stats.totalShows} />
        <StatCard label="Finished" value={stats.finished} />
        <StatCard label="Episodes watched" value={stats.episodesWatched} />
        <StatCard label="Avg rating" value={stats.avg !== null ? stats.avg.toFixed(1) : '—'} />
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <TabButton active={tab === 'diary'} onClick={() => setTab('diary')}>
            Diary
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            History
          </TabButton>
        </div>

        {tab === 'history' && history.length > 0 && (
          <div className="flex items-center gap-1">
            {(Object.keys(SORT_LABELS) as HistorySort[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                  sort === key
                    ? 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40'
                    : 'text-base-500 hover:text-base-200'
                }`}
              >
                {SORT_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-base-850/70" />
          ))}
        </div>
      ) : tab === 'diary' ? (
        ratings.length === 0 ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <div className="mb-3 text-4xl">⭐</div>
            <p className="text-sm text-base-500">
              No ratings yet.{' '}
              <Link to="/search" className="text-accent-400 hover:underline">
                Find a show
              </Link>{' '}
              to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {diaryGroups.map((group) => (
              <div key={group.heading + group.items[0].id}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-500">
                  {group.heading}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((r, i) => (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.02 }}
                    >
                      <Link
                        to={`/show/${r.show_id}`}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-base-850/60 p-2.5 transition-colors duration-200 hover:bg-base-800/70"
                      >
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-base-800">
                          {r.show_poster_path && (
                            <img
                              src={posterUrl(r.show_poster_path, 'w185') ?? undefined}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-base-100">{r.show_name}</p>
                          <p className="text-xs text-base-400">Rated</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-star">
                          {r.rating.toFixed(1)}
                          <StarGlyph />
                        </div>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="mb-3 text-4xl">✅</div>
          <p className="text-sm text-base-500">
            Nothing finished yet. Shows show up here once every episode is watched, or once
            they&apos;re rated.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {history.map((s, i) => (
            <motion.div
              key={s.showId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.02 }}
            >
              <Link to={`/u/${username}/shows/${s.showId}`} className="group block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-base-800 ring-1 ring-white/5 transition-shadow duration-300 group-hover:shadow-[0_8px_30px_rgba(139,92,246,0.25)]">
                  {s.showPosterPath ? (
                    <img
                      src={posterUrl(s.showPosterPath) ?? undefined}
                      alt={s.showName}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-base-400">
                      {s.showName}
                    </div>
                  )}
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
                  {(s.finishedAt ?? s.ratedAt) ? formatShortDate((s.finishedAt ?? s.ratedAt)!) : ''}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
        active ? 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40' : 'text-base-400 hover:text-base-200'
      }`}
    >
      {children}
    </button>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-base-850/60 p-3.5 text-center">
      <p className="text-lg font-semibold text-base-100 sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-base-500">{label}</p>
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
