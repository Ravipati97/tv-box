export function ShowCardSkeleton({ progress = false }: { progress?: boolean }) {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-2xl bg-base-800" />
      <div className="mt-2 h-3.5 w-3/4 rounded bg-base-800" />
      {/* Now Watching cards carry a season-progress bar under the title
          instead of a second line of text -- swap the placeholder shape to
          match so a grid of these doesn't visibly change proportions once
          real cards load in. */}
      {progress ? (
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-base-800" />
      ) : (
        <div className="mt-1.5 h-3 w-1/3 rounded bg-base-800" />
      )}
    </div>
  )
}

export function ShowGridSkeleton({ count = 12, progress = false }: { count?: number; progress?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <ShowCardSkeleton key={i} progress={progress} />
      ))}
    </div>
  )
}

// Mirrors EpisodeRow.tsx's actual layout (full-width stacked image on
// mobile, side-by-side from sm: up) -- a skeleton with the old fixed-width
// side-by-side shape would pop into a visibly different layout the instant
// real content loads in.
export function EpisodeRowSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3 rounded-xl border border-hairline bg-base-850/60 p-3 sm:flex-row sm:gap-4 sm:p-4">
      <div className="aspect-video w-full shrink-0 rounded-lg bg-base-800 sm:w-40" />
      <div className="min-w-0 flex-1 space-y-2 py-1">
        <div className="h-2.5 w-16 rounded bg-base-800" />
        <div className="h-3.5 w-2/3 rounded bg-base-800" />
        <div className="h-3 w-full rounded bg-base-800" />
        <div className="h-3 w-4/5 rounded bg-base-800" />
      </div>
    </div>
  )
}
