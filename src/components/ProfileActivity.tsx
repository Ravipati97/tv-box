import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchRecentShowRatings } from '../lib/showRatings'
import { fetchRecentWatched } from '../lib/watched'
import { fetchRecentRewatches } from '../lib/rewatches'
import { buildDiaryEntries, buildUndatedDiaryEntries, summarizeShowActivity, watchHistory } from '../lib/showActivity'
import type { DiaryEntry } from '../lib/showActivity'
import { addToWatchlist, fetchWatchlist, removeFromWatchlist } from '../lib/watchlist'
import { createList, fetchListsForUser } from '../lib/lists'
import { posterUrl } from '../lib/tmdb'
import { dayKey, formatDiaryHeading, formatShortDate } from '../lib/date'
import { useAuth } from '../contexts/AuthContext'
import HistorySection from './HistorySection'
import RatingDistribution from './RatingDistribution'
import Toast from './Toast'
import { useToast } from '../hooks/useToast'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'
import type { EpisodeWatched, ShowListWithCount, ShowRating, ShowRewatch, WatchlistItem } from '../types'

interface ProfileActivityProps {
  userId: string
  username: string
}

interface DiaryDayGroup {
  heading: string
  entries: DiaryEntry[]
}

type Tab = 'diary' | 'history' | 'watchlist' | 'lists'

export default function ProfileActivity({ userId, username }: ProfileActivityProps) {
  const { user: me } = useAuth()
  const isMe = me?.id === userId
  const [tab, setTab] = useState<Tab>('diary')
  const [ratings, setRatings] = useState<ShowRating[]>([])
  const [watched, setWatched] = useState<EpisodeWatched[]>([])
  const [rewatches, setRewatches] = useState<ShowRewatch[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [lists, setLists] = useState<ShowListWithCount[]>([])
  const [creatingList, setCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [savingList, setSavingList] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast, showUndo, showError, dismiss } = useToast()

  useEscapeAndFocusReturn(creatingList, () => setCreatingList(false))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRecentShowRatings(userId, 2000),
      fetchRecentWatched(userId, 2000),
      fetchRecentRewatches(userId, 2000),
      fetchWatchlist(userId),
      fetchListsForUser(userId),
    ])
      .then(([ratingRows, watchedRows, rewatchRows, watchlistRows, listRows]) => {
        if (!cancelled) {
          setRatings(ratingRows)
          setWatched(watchedRows)
          setRewatches(rewatchRows)
          setWatchlist(watchlistRows)
          setLists(listRows)
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

  async function handleRemoveFromWatchlist(item: WatchlistItem) {
    setWatchlist((prev) => prev.filter((w) => w.show_id !== item.show_id))
    try {
      await removeFromWatchlist(userId, item.show_id)
    } catch {
      setWatchlist((prev) => [item, ...prev])
      showError(`Failed to remove ${item.show_name}. Try again.`)
      return
    }
    showUndo(`Removed ${item.show_name} from watchlist`, async () => {
      try {
        const saved = await addToWatchlist({
          userId,
          showId: item.show_id,
          showName: item.show_name,
          showPosterPath: item.show_poster_path,
        })
        setWatchlist((prev) => [saved, ...prev])
      } catch {
        showError('Failed to undo. Try adding it back manually.')
      }
    })
  }

  async function handleCreateList() {
    const name = newListName.trim()
    if (!name) return
    setSavingList(true)
    try {
      const list = await createList(userId, name)
      setLists((prev) => [{ ...list, itemCount: 0 }, ...prev])
      setNewListName('')
      setCreatingList(false)
    } catch {
      showError('Failed to create list. Try again.')
    } finally {
      setSavingList(false)
    }
  }

  const activity = useMemo(() => summarizeShowActivity(ratings, watched), [ratings, watched])

  const stats = useMemo(() => {
    const totalShows = ratings.length
    const finished = activity.filter((s) => s.finished).length
    const avg = totalShows === 0 ? null : ratings.reduce((sum, r) => sum + r.rating, 0) / totalShows
    // Rows logged before runtime_minutes existed contribute 0 here rather
    // than being excluded -- see scripts/backfill-runtime.mjs to fill them in.
    const hoursWatched = Math.round(watched.reduce((sum, w) => sum + (w.runtime_minutes ?? 0), 0) / 60)
    return { totalShows, finished, episodesWatched: watched.length, avg, hoursWatched }
  }, [ratings, watched, activity])

  // Every dated, personally-loggable event (watched, rated, rewatched)
  // merged into one timeline -- see buildDiaryEntries. Already sorted
  // newest-first, so grouping is just "start a new bucket whenever the
  // calendar day changes."
  const diaryEntries = useMemo(() => buildDiaryEntries(ratings, watched, rewatches), [ratings, watched, rewatches])
  const undatedDiaryEntries = useMemo(() => buildUndatedDiaryEntries(watched), [watched])

  const diaryGroups = useMemo<DiaryDayGroup[]>(() => {
    const groups: DiaryDayGroup[] = []
    let currentKey = ''
    for (const entry of diaryEntries) {
      const key = dayKey(entry.at)
      if (key !== currentKey) {
        groups.push({ heading: formatDiaryHeading(entry.at), entries: [entry] })
        currentKey = key
      } else {
        groups[groups.length - 1].entries.push(entry)
      }
    }
    return groups
  }, [diaryEntries])

  const history = useMemo(() => watchHistory(activity), [activity])

  return (
    <div>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Shows rated" value={stats.totalShows} />
        <StatCard label="Finished" value={stats.finished} />
        <StatCard label="Episodes watched" value={stats.episodesWatched} />
        <StatCard label="Hours watched" value={stats.hoursWatched} />
        <StatCard label="Avg rating" value={stats.avg !== null ? stats.avg.toFixed(1) : '—'} />
      </div>

      <RatingDistribution ratings={ratings} />

      <div className="mb-4 flex items-center gap-1">
        <TabButton active={tab === 'diary'} onClick={() => setTab('diary')}>
          Diary
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          History
        </TabButton>
        <TabButton active={tab === 'watchlist'} onClick={() => setTab('watchlist')}>
          Watchlist
        </TabButton>
        <TabButton active={tab === 'lists'} onClick={() => setTab('lists')}>
          Lists
        </TabButton>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-base-850/70" />
          ))}
        </div>
      ) : tab === 'diary' ? (
        diaryGroups.length === 0 && undatedDiaryEntries.length === 0 ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <div className="mb-3 text-4xl">📔</div>
            <p className="text-sm text-base-500">
              Nothing logged yet. Mark an episode watched or rate a show, and it'll show up here.{' '}
              <Link to="/search" className="text-accent-400 hover:underline">
                Find a show
              </Link>{' '}
              to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {diaryGroups.map((group) => (
              <div key={group.heading + group.entries[0].id}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-500">
                  {group.heading}
                </h3>
                <ul className="space-y-2">
                  {group.entries.map((entry, i) => (
                    <DiaryRow key={entry.id} entry={entry} index={i} />
                  ))}
                </ul>
              </div>
            ))}

            {undatedDiaryEntries.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-500">
                  Date unknown
                </h3>
                <ul className="space-y-2">
                  {undatedDiaryEntries.map((entry, i) => (
                    <DiaryRow key={entry.id} entry={entry} index={i} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      ) : tab === 'history' ? (
        <HistorySection
          activity={history}
          username={username}
          emptyMessage="Nothing finished yet. Shows show up here once every episode is watched, or once they're rated."
        />
      ) : tab === 'watchlist' ? (
        watchlist.length === 0 ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <div className="mb-3 text-4xl">🔖</div>
            <p className="text-sm text-base-500">
              {isMe ? "Nothing on your watchlist yet. " : 'Nothing here yet. '}
              {isMe && (
                <>
                  <Link to="/search" className="text-accent-400 hover:underline">
                    Find a show
                  </Link>{' '}
                  to save one for later.
                </>
              )}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {watchlist.map((w, i) => (
              <motion.li
                key={w.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.02 }}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-base-850/60 p-2.5"
              >
                <Link to={`/show/${w.show_id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-base-800">
                    {w.show_poster_path && (
                      <img
                        src={posterUrl(w.show_poster_path, 'w185') ?? undefined}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-base-100">{w.show_name}</p>
                    <p className="text-xs text-base-400">Added {formatShortDate(w.added_at)}</p>
                  </div>
                </Link>
                {isMe && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFromWatchlist(w)}
                    className="shrink-0 text-xs text-base-500 hover:text-danger"
                  >
                    Remove
                  </button>
                )}
              </motion.li>
            ))}
          </ul>
        )
      ) : (
        <div>
          {isMe && (
            <div className="mb-4">
              {creatingList ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleCreateList()
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    autoFocus
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="List name"
                    className="w-full max-w-xs rounded-lg border border-hairline-strong bg-base-900 px-2.5 py-1.5 text-xs text-base-200 placeholder:text-base-600"
                  />
                  <button
                    type="submit"
                    disabled={!newListName.trim() || savingList}
                    className="shrink-0 rounded-lg bg-accent-500/15 px-2.5 py-1.5 text-xs font-medium text-accent-300 ring-1 ring-accent-500/40 disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingList(false)}
                    className="shrink-0 text-xs text-base-500 hover:text-base-300"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingList(true)}
                  className="text-xs text-accent-400 hover:underline"
                >
                  + New list
                </button>
              )}
            </div>
          )}

          {lists.length === 0 ? (
            <div className="mt-6 flex flex-col items-center text-center">
              <div className="mb-3 text-4xl">📋</div>
              <p className="text-sm text-base-500">No lists yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {lists.map((l, i) => (
                <motion.li
                  key={l.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.02 }}
                >
                  <Link
                    to={`/u/${username}/lists/${l.id}`}
                    className="flex items-center justify-between rounded-xl border border-hairline bg-base-850/60 p-3 transition-colors duration-200 hover:bg-base-800/70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-base-100">{l.name}</p>
                      {l.description && (
                        <p className="truncate text-xs text-base-500">{l.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-base-500">
                      {l.itemCount} show{l.itemCount === 1 ? '' : 's'}
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} action={toast.action} onDismiss={dismiss} />}
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
    <div className="rounded-xl border border-hairline bg-base-850/60 p-3.5 text-center">
      <p className="text-lg font-semibold text-base-100 sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-base-500">{label}</p>
    </div>
  )
}

/** One row in the diary -- shape (poster, name, link) is shared across all
 * three entry kinds; only the subtitle and the right-side badge differ. */
function DiaryRow({ entry, index }: { entry: DiaryEntry; index: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.02 }}
    >
      <Link
        to={`/show/${entry.showId}`}
        className="flex items-center gap-3 rounded-xl border border-hairline bg-base-850/60 p-2.5 transition-colors duration-200 hover:bg-base-800/70"
      >
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-base-800">
          {entry.showPosterPath && (
            <img
              src={posterUrl(entry.showPosterPath, 'w185') ?? undefined}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-base-100">{entry.showName}</p>
          <p className="flex items-center gap-1 text-xs text-base-400">
            {entry.kind === 'rated' && 'Rated'}
            {entry.kind === 'rewatched' && (
              <>
                <RewatchGlyph />
                Rewatched
              </>
            )}
            {entry.kind === 'watched' && (
              <>
                <WatchedGlyph />
                {entry.episodeLabel ? (
                  <>Watched {entry.episodeLabel}</>
                ) : (
                  <>
                    Watched {entry.episodeCount} episode{entry.episodeCount === 1 ? '' : 's'}
                    {entry.seasonLabel ? ` · ${entry.seasonLabel}` : ''}
                  </>
                )}
              </>
            )}
          </p>
        </div>
        {entry.rating != null && (
          <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-star">
            {entry.rating.toFixed(1)}
            <StarGlyph />
          </div>
        )}
      </Link>
    </motion.li>
  )
}

function StarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}

function WatchedGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent-400)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

function RewatchGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent-400)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
      <path d="M18 4v4h-4M6 20v-4h4" />
    </svg>
  )
}
