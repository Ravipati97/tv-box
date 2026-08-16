import { useEffect, useRef, useState } from 'react'
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
  // Whether the clamped overview actually overflows 2 lines -- measured
  // once, while still collapsed, so "Show more" only appears when there's
  // really more text to reveal (a short one-line overview shouldn't get a
  // toggle that does nothing). Tapping the thumbnail or the title used to
  // silently expand the description too, with no visual hint either was
  // interactive -- an explicit "Show more" link is the standard, actually
  // discoverable version of that same affordance.
  const [isTruncated, setIsTruncated] = useState(false)
  const overviewRef = useRef<HTMLParagraphElement>(null)
  const still = stillUrl(episode.still_path)

  useEffect(() => {
    const el = overviewRef.current
    if (!el) return
    setIsTruncated(el.scrollHeight > el.clientHeight + 1)
  }, [episode.overview])
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
      {/* Stacked (image full-width on top, text below) on mobile, side by
          side from sm: up. A fixed 112px-wide side-by-side thumbnail left a
          ton of dead space under it once its height stopped being distorted
          to match the text column (see items-start above) -- letting the
          image run the card's full width instead gives it real presence
          (roughly 3x bigger) and gives the text column enough room that
          "Show more" is rarely even needed. Desktop keeps the original
          side-by-side layout, which already had room to spare. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-base-800 sm:w-40 sm:shrink-0">
          {still ? (
            <img
              src={still}
              // The still renders small (112-160 CSS px wide) but phone
              // screens are commonly 2-3x device pixel ratio, and w300
              // alone falls short of that -- looked fine on a 1x laptop
              // display, soft/pixelated on a real phone. Letting the
              // browser pick a density-matched variant fixes that without
              // over-fetching the larger sizes on 1x displays.
              srcSet={`${stillUrl(episode.still_path, 'w300')} 1x, ${stillUrl(episode.still_path, 'w780')} 2x, ${stillUrl(episode.still_path, 'w1280')} 3x`}
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
          {/* Runtime moved here (off the title row, which no longer needs to
              share space with it) -- a corner badge on the still is the
              same place every streaming app already puts it. */}
          {episode.runtime ? (
            <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              {episode.runtime}m
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-400">
            Episode {episode.episode_number}
          </p>
          <p className="text-sm font-medium text-base-100 sm:text-base">
            {episode.name || `Episode ${episode.episode_number}`}
          </p>

          <p
            ref={overviewRef}
            className={`mt-1 text-xs text-base-400 sm:text-sm ${expanded ? '' : 'line-clamp-2'}`}
          >
            {episode.overview || 'No synopsis available.'}
          </p>
          {isTruncated && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-xs font-medium text-accent-400 hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}

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
