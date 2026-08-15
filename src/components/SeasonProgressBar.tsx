import type { SeasonSegment } from '../lib/seasonProgress'

/**
 * A story-bar style progress readout: one capsule per season instead of one
 * bar for the whole show. Finished seasons read as solid, the current one
 * as partially filled, later ones as empty track -- the whole watch history
 * at a glance, the same way a Story's segmented bar tells you how many are
 * left without a single number. Falls back to a single bar for single-season
 * shows, where a "season breakdown" would just repeat the overall fraction.
 */
export default function SeasonProgressBar({ segments }: { segments: SeasonSegment[] }) {
  if (segments.length <= 1) {
    const s = segments[0]
    const pct = s && s.total > 0 ? Math.min(100, (s.watched / s.total) * 100) : 0
    return (
      <div className="h-1 w-full overflow-hidden rounded-full bg-base-800">
        <div
          className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-1 w-full items-center gap-0.5">
      {segments.map((s) => {
        const pct = s.total > 0 ? Math.min(100, (s.watched / s.total) * 100) : 0
        return (
          <div
            key={s.seasonNumber}
            title={`Season ${s.seasonNumber} · ${s.watched}/${s.total}`}
            className="h-full min-w-[3px] flex-1 overflow-hidden rounded-full bg-base-800"
          >
            <div
              className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        )
      })}
    </div>
  )
}
