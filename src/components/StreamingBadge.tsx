import { providerLogoUrl } from '../lib/tmdb'
import type { ResolvedProvider } from '../lib/streamingProvider'

/**
 * Small corner badge showing where a show is free to stream -- the same
 * resolved answer (override-first, else best free guess) as the "Streaming"
 * section on the show page, just surfaced everywhere its poster shows up so
 * you don't have to open a show to see where it lives. Renders nothing if
 * there's no resolved provider yet or no logo to show, so it never leaves a
 * broken-image placeholder behind.
 */
export default function StreamingBadge({ provider }: { provider: ResolvedProvider | null | undefined }) {
  const logo = provider ? providerLogoUrl(provider.logo_path) : null
  if (!provider || !logo) return null

  return (
    <div
      title={provider.provider_name}
      className="absolute right-1.5 top-1.5 h-6 w-6 overflow-hidden rounded-md shadow-md ring-1 ring-black/30"
    >
      <img src={logo} alt="" className="h-full w-full object-cover" />
    </div>
  )
}
