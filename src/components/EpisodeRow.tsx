import { useState } from 'react'
import { motion } from 'framer-motion'
import { stillUrl } from '../lib/tmdb'
import { formatShortDate, isFutureDate } from '../lib/date'
import DateMarkControl from './DateMarkControl'
import type { TmdbEpisode } from '../types'

interface EpisodeRowProps {
  episode: TmdbEpisode
  watched: boolean
  watchedAt: string | null
  watchedAtUnknown: boolean
  /** One click, always "today" -- the fast path for the common case of
   * marking an episode right after watching it. */
  onToggleWatched: () => Promise<void>
  /** The slower path: pick a specific date (or "don't remember"), for
   * logging episodes watched before today one at a time. */
  onMarkWatchedWithDate: (input: { watchedAt: string; unknownDate: boolean }) => Promise<void>
}

export default function EpisodeRow({
  episode,
  watched,
  watchedAt,
  watchedAtUnknown,
  onToggleWatched,
  onMarkWatchedWithDate,
}: EpisodeRowProps) {
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const still = stillUrl(episode.still_path)
  // TMDB lists placeholder rows for episodes that haven't aired yet (no
  // synopsis, no image, generic "Episode N" title) for shows still airing --
  // marking one of these "watched" would be nonsensical, and doing it by
  // accident is exactly the kind of thing that makes a show's progress
  // look stuck. Only treated as upcoming with a real, known future date --
  // a missing air_date on an already-released obscure episode shouldn't
  // get swept up in this.
  const isUpcoming = Boolean(episode.air_date && isFutureDate(episode.air_date))

  async function handleToggle() {
    setSaving(true)
    try {
      await onToggleWatched()
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`group rounded-xl border border-hairline bg-base-850/60 p-3 transition-colors duration-200 hover:bg-base-800/70 sm:p-4 ${
        watched ? 'ring-1 ring-inset ring-accent-500/20' : ''
      } ${isUpcoming ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-base-800 sm:w-40"
        >
          {still ? (
            <img
              src={still}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-base-500">
              No image
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-400">
                Episode {episode.episode_number}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-left text-sm font-medium text-base-100 sm:text-base"
              >
                {episode.name || `Episode ${episode.episode_number}`}
              </button>
            </div>
            {episode.runtime ? (
              <span className="shrink-0 text-xs text-base-500">{episode.runtime}m</span>
            ) : null}
          </div>

          <p
            className={`mt-1 text-xs text-base-400 sm:text-sm ${expanded ? '' : 'line-clamp-2'}`}
          >
            {episode.overview || 'No synopsis available.'}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:mt-3">
            {isUpcoming ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong px-3 py-1.5 text-xs font-medium text-base-500">
                Airs {formatShortDate(episode.air_date!)}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={saving}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200 disabled:opacity-60 ${
                    watched
                      ? 'border-accent-500/40 bg-accent-500/15 text-accent-300'
                      : 'border-hairline-strong text-base-400 hover:border-accent-500/40 hover:text-base-200'
                  }`}
                >
                  <CheckGlyph filled={watched} />
                  {watched
                    ? watchedAtUnknown
                      ? 'Watched a while ago'
                      : `Watched${watchedAt ? ` ${formatShortDate(watchedAt)}` : ''}`
                    : 'Mark watched'}
                  {saving && (
                    <span className="ml-0.5 h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                  )}
                </button>
                {/* Fast path above always stamps "now" -- this is the second
                    option for logging an episode watched on some other day,
                    without slowing down the common one-tap case. Always
                    rendered (just hidden once watched, via `invisible` not
                    conditional rendering) so this row's layout height never
                    changes on toggle -- unmounting it here used to shrink the
                    card by a whole line the instant you marked an episode
                    watched, visibly resizing/jumping every card below it. */}
                <DateMarkControl
                  label="Watched in the past"
                  onConfirm={onMarkWatchedWithDate}
                  className={watched ? 'invisible' : ''}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function CheckGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={filled ? 'var(--color-accent-400)' : 'none'}
        stroke={filled ? 'var(--color-accent-400)' : 'currentColor'}
        strokeWidth="1.6"
      />
      {filled && (
        <path
          d="M7.5 12.5l3 3 6-6.5"
          stroke="var(--color-base-950)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </svg>
  )
}
