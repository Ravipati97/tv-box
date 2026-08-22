import type { ReactNode } from 'react'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'
import {
  emptyHistoryFilters,
  isHistoryFiltersActive,
  type HistoryFilterFacets,
  type HistoryFilters,
} from '../lib/historyFilters'

// Built once and reused for every .of() call rather than per-render --
// these are just ISO-code -> readable-name lookups (e.g. "KR" -> "South
// Korea", "ko" -> "Korean"), no reason to recreate them constantly. Guarded
// since Intl.DisplayNames, while broadly supported, isn't guaranteed.
const countryNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const languageNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'language' })
    : null

function countryLabel(code: string): string {
  try {
    return countryNames?.of(code) ?? code
  } catch {
    return code
  }
}

function languageLabel(code: string): string {
  try {
    return languageNames?.of(code) ?? code
  } catch {
    return code
  }
}

const RATED_LABELS = { any: 'All', rated: 'Rated', unrated: 'Unrated' } as const

export default function HistoryFiltersPanel({
  facets,
  filters,
  onChange,
  loadingDetails,
  onClose,
}: {
  facets: HistoryFilterFacets
  filters: HistoryFilters
  onChange: (filters: HistoryFilters) => void
  loadingDetails: boolean
  onClose: () => void
}) {
  useEscapeAndFocusReturn(true, onClose)

  function toggleSetValue(key: 'genres' | 'countries' | 'languages' | 'platforms' | 'statuses', value: string) {
    const next = new Set(filters[key])
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange({ ...filters, [key]: next })
  }

  return (
    <div className="mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-hairline-strong bg-base-900 p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-500">Filters</p>
        <div className="flex items-center gap-3">
          {isHistoryFiltersActive(filters) && (
            <button
              type="button"
              onClick={() => onChange(emptyHistoryFilters())}
              className="text-xs text-accent-400 hover:underline"
            >
              Clear all
            </button>
          )}
          <button type="button" onClick={onClose} className="text-xs text-base-500 hover:text-base-300">
            Close
          </button>
        </div>
      </div>

      <FilterSection title="Rating">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(RATED_LABELS) as (keyof typeof RATED_LABELS)[]).map((r) => (
            <Chip
              key={r}
              active={filters.rated === r}
              onClick={() => onChange({ ...filters, rated: r, minRating: r === 'rated' ? filters.minRating : null })}
            >
              {RATED_LABELS[r]}
            </Chip>
          ))}
        </div>
        {filters.rated === 'rated' && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] text-base-500">At least</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip
                key={n}
                active={filters.minRating === n}
                onClick={() => onChange({ ...filters, minRating: filters.minRating === n ? null : n })}
              >
                {n}+★
              </Chip>
            ))}
          </div>
        )}
      </FilterSection>

      {facets.genres.length > 0 && (
        <FilterSection title="Genre">
          <ChipGroup options={facets.genres} selected={filters.genres} onToggle={(v) => toggleSetValue('genres', v)} />
        </FilterSection>
      )}

      {facets.minYear !== null && facets.maxYear !== null && (
        <FilterSection title="Year">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              aria-label="From year"
              min={facets.minYear}
              max={facets.maxYear}
              placeholder={String(facets.minYear)}
              value={filters.yearFrom ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim()
                onChange({ ...filters, yearFrom: v === '' ? null : Number(v) })
              }}
              className="w-20 rounded-lg border border-hairline-strong bg-base-950 px-2 py-1 text-xs text-base-200"
            />
            <span className="text-xs text-base-500">to</span>
            <input
              type="number"
              inputMode="numeric"
              aria-label="To year"
              min={facets.minYear}
              max={facets.maxYear}
              placeholder={String(facets.maxYear)}
              value={filters.yearTo ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim()
                onChange({ ...filters, yearTo: v === '' ? null : Number(v) })
              }}
              className="w-20 rounded-lg border border-hairline-strong bg-base-950 px-2 py-1 text-xs text-base-200"
            />
          </div>
        </FilterSection>
      )}

      {facets.platforms.length > 0 && (
        <FilterSection title="Platform">
          <ChipGroup
            options={facets.platforms}
            selected={filters.platforms}
            onToggle={(v) => toggleSetValue('platforms', v)}
          />
        </FilterSection>
      )}

      {facets.statuses.length > 0 && (
        <FilterSection title="Status">
          <ChipGroup options={facets.statuses} selected={filters.statuses} onToggle={(v) => toggleSetValue('statuses', v)} />
        </FilterSection>
      )}

      {facets.countries.length > 0 && (
        <FilterSection title="Country">
          <ChipGroup
            options={facets.countries}
            selected={filters.countries}
            onToggle={(v) => toggleSetValue('countries', v)}
            labelFor={countryLabel}
          />
        </FilterSection>
      )}

      {facets.languages.length > 0 && (
        <FilterSection title="Language">
          <ChipGroup
            options={facets.languages}
            selected={filters.languages}
            onToggle={(v) => toggleSetValue('languages', v)}
            labelFor={languageLabel}
          />
        </FilterSection>
      )}

      {loadingDetails && <p className="mt-3 text-[11px] text-base-600">Loading more filter options…</p>}
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-base-600">{title}</p>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
        active
          ? 'bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/40'
          : 'bg-base-850/60 text-base-400 ring-1 ring-hairline hover:text-base-200'
      }`}
    >
      {children}
    </button>
  )
}

function ChipGroup({
  options,
  selected,
  onToggle,
  labelFor,
}: {
  options: string[]
  selected: Set<string>
  onToggle: (value: string) => void
  labelFor?: (value: string) => string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <Chip key={opt} active={selected.has(opt)} onClick={() => onToggle(opt)}>
          {labelFor ? labelFor(opt) : opt}
        </Chip>
      ))}
    </div>
  )
}
