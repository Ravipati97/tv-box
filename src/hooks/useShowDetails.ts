import { useEffect, useState } from 'react'
import { getShowDetailsBulk } from '../lib/tmdb'
import type { TmdbShowDetail } from '../types'

/**
 * Bulk TMDB show details (genre, year, country, language, status) for the
 * History filters -- same shape as useStreamingPlatforms, so the two can
 * sit side by side in HistorySection.
 *
 * `enabled` gates the fetch entirely: the filters panel is what needs this
 * data, and most History views never open it, so this only fires once
 * someone actually expands Filters rather than on every History tab visit.
 */
export function useShowDetails(
  showIds: number[],
  enabled: boolean,
): { details: Map<number, TmdbShowDetail>; loading: boolean } {
  const [details, setDetails] = useState<Map<number, TmdbShowDetail>>(new Map())
  const [loading, setLoading] = useState(false)
  const key = showIds.join(',')

  useEffect(() => {
    if (!enabled || !key) {
      return
    }
    let cancelled = false
    setLoading(true)
    getShowDetailsBulk(key.split(',').map(Number))
      .then((map) => {
        if (!cancelled) setDetails(map)
      })
      .catch(() => {
        // Filters degrade gracefully -- a show missing from the map just
        // won't match any genre/year/country/language facet.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [key, enabled])

  return { details, loading }
}
