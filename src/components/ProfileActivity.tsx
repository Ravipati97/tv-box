import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchRecentRatings } from '../lib/ratings'
import { posterUrl } from '../lib/tmdb'
import { dayKey, formatDiaryHeading } from '../lib/date'
import type { EpisodeRating } from '../types'

interface ProfileActivityProps {
  userId: string
  username: string
}

interface DiaryGroup {
  heading: string
  items: EpisodeRating[]
}

interface ShowSummary {
  showId: number
  showName: string
  showPosterPath: string | null
  count: number
  avg: number
  mostRecent: string
}

type Tab = 'diary' | 'shows'

export default function ProfileActivity({ userId, username }: ProfileActivityProps) {
  const [tab, setTab] = useState<Tab>('diary')
  const [ratings, setRatings] = useState<EpisodeRating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    // High cap, not a "recent 60" -- both the Diary and Shows tabs need the
    // full history, not just the latest handful.
    fetchRecentRatings(userId, 2000)
      .then((data) => {
        if (!cancelled) setRatings(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load ratings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const stats = useMemo(() => {
    const totalEpisodes = ratings.length
    const showIds = new Set(ratings.map((r) => r.show_id))
    const avg = totalEpisodes === 0 ? null : ratings.reduce((sum, r) => sum + r.rating, 0) / totalEpisodes
    return { totalEpisodes, totalShows: showIds.size, avg }
  }, [ratings])

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

  const shows = useMemo<ShowSummary[]>(() => {
    const byShow = new Map<number, EpisodeRating[]>()
    for (const r of ratings) {
      const list = byShow.get(r.show_id)
      if (list) list.push(r)
      else byShow.set(r.show_id, [r])
    }
    const summaries = Array.from(byShow.values()).map((items): ShowSummary => ({
      showId: items[0].show_id,
      showName: items[0].show_name,
      showPosterPath: items[0].show_poster_path,
      count: items.length,
      avg: items.reduce((sum, r) => sum + r.rating, 0) / items.length,
      // items are already newest-first within the overall sort, so [0] is the most recent
      mostRecent: items[0].rated_at,
    }))
    summaries.sort((a, b) => (a.mostRecent < b.mostRecent ? 1 : -1))
    return summaries
  }, [ratings])

  return (
    <div>
      <div className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="Episodes rated" value={stats.totalEpisodes} />
        <StatCard label="Shows" value={stats.totalShows} />
        <StatCard label="Avg rating" value={stats.avg !== null ? stats.avg.toFixed(1) : '—'} />
      </div>

      <div className="mb-4 flex items-center gap-1">
        <TabButton active={tab === 'diary'} onClick={() => setTab('diary')}>
          Diary
        </TabButton>
        <TabButton active={tab === 'shows'} onClick={() => setTab('shows')}>
          Shows
        </TabButton>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-base-850/70" />
          ))}
        </div>
      ) : ratings.length === 0 ? (
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
      ) : tab === 'diary' ? (
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
                        <p className="text-xs text-base-400">
                          S{r.season_number} · E{r.episode_number}
                          {r.episode_name ? ` — ${r.episode_name}` : ''}
                        </p>
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
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shows.map((s, i) => (
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
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-star">
                      {s.avg.toFixed(1)}
                      <StarGlyph />
                    </div>
                  </div>
                </div>
                <p className="mt-2 truncate text-sm font-medium text-base-100">{s.showName}</p>
                <p className="text-xs text-base-400">
                  {s.count} {s.count === 1 ? 'episode' : 'episodes'}
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
