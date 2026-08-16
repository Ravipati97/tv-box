import { useEffect, useMemo, useState } from 'react'
import { getAllTvProviders, providerLogoUrl } from '../lib/tmdb'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'
import type { TmdbProviderListItem } from '../types'

/**
 * Small searchable panel for manually correcting "where to watch" -- backed
 * by TMDB's full provider list (not just the ones already known for this
 * show), since the whole point is fixing a wrong or missing automatic guess.
 */
export default function ProviderPicker({
  region,
  onPick,
  onClose,
}: {
  region: string
  onPick: (provider: TmdbProviderListItem) => void | Promise<void>
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [allProviders, setAllProviders] = useState<TmdbProviderListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Only ever mounted while open (ShowDetail conditionally renders it) --
  // so "active" for the whole lifetime of this component instance.
  useEscapeAndFocusReturn(true, onClose)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getAllTvProviders(region)
      .then((data) => {
        if (!cancelled) setAllProviders(data)
      })
      .catch(() => {
        if (!cancelled) setAllProviders([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [region])

  const matches = useMemo(() => {
    if (!allProviders) return []
    const q = query.trim().toLowerCase()
    const filtered = q ? allProviders.filter((p) => p.provider_name.toLowerCase().includes(q)) : allProviders
    return filtered.slice(0, 8)
  }, [allProviders, query])

  return (
    <div className="mt-2 rounded-xl border border-hairline-strong bg-base-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search platforms (Netflix, Hulu, Max...)"
          className="w-full rounded-lg border border-hairline-strong bg-base-950 px-2.5 py-1.5 text-xs text-base-200 placeholder:text-base-600"
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs text-base-500 hover:text-base-300"
        >
          Close
        </button>
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto">
        {loading ? (
          <p className="px-1 py-2 text-xs text-base-500">Loading platforms…</p>
        ) : matches.length === 0 ? (
          <p className="px-1 py-2 text-xs text-base-500">No matches.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {matches.map((p) => (
              <button
                key={p.provider_id}
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true)
                  try {
                    await onPick(p)
                  } finally {
                    setSaving(false)
                  }
                }}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs text-base-200 transition-colors duration-150 hover:bg-hover disabled:opacity-50"
              >
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded bg-base-800 ring-1 ring-hairline-strong">
                  {providerLogoUrl(p.logo_path) ? (
                    <img
                      src={providerLogoUrl(p.logo_path) ?? undefined}
                      alt={p.provider_name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                {p.provider_name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
