export function ShowCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-2xl bg-base-800" />
      <div className="mt-2 h-3.5 w-3/4 rounded bg-base-800" />
      <div className="mt-1.5 h-3 w-1/3 rounded bg-base-800" />
    </div>
  )
}

export function ShowGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <ShowCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function EpisodeRowSkeleton() {
  return (
    <div className="flex animate-pulse gap-3 rounded-xl border border-hairline bg-base-850/60 p-3 sm:gap-4 sm:p-4">
      <div className="aspect-video w-28 shrink-0 rounded-lg bg-base-800 sm:w-40" />
      <div className="min-w-0 flex-1 space-y-2 py-1">
        <div className="h-2.5 w-16 rounded bg-base-800" />
        <div className="h-3.5 w-2/3 rounded bg-base-800" />
        <div className="h-3 w-full rounded bg-base-800" />
        <div className="h-3 w-4/5 rounded bg-base-800" />
      </div>
    </div>
  )
}
