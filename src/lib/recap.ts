import type { ShowActivity } from './showActivity'
import type { EpisodeWatched, ShowRating, ShowRewatch } from '../types'

export interface YearRecap {
  year: number
  showsFinished: number
  episodesWatched: number
  hoursWatched: number
  ratingsGiven: number
  avgRating: number | null
  topRated: { showId: number; showName: string; showPosterPath: string | null; rating: number } | null
  mostActiveMonth: string | null
  rewatches: number
}

function inYear(iso: string, year: number): boolean {
  return new Date(iso).getFullYear() === year
}

/** Every calendar year with *any* activity, newest first -- for the year picker.
 * Unknown-date watches carry a placeholder epoch timestamp and are excluded,
 * or they'd all wrongly surface a "1970" year. */
export function availableRecapYears(
  ratings: ShowRating[],
  watched: EpisodeWatched[],
  rewatches: ShowRewatch[],
): number[] {
  const years = new Set<number>()
  for (const r of ratings) years.add(new Date(r.rated_at).getFullYear())
  for (const w of watched) if (!w.watched_at_unknown) years.add(new Date(w.watched_at).getFullYear())
  for (const r of rewatches) years.add(new Date(r.rewatched_at).getFullYear())
  return Array.from(years).sort((a, b) => b - a)
}

/** Builds one year's recap from already-fetched data -- ShowActivity (from
 * summarizeShowActivity) for "finished this year", and the raw rows for
 * everything else, since ShowActivity only keeps one rating per show. */
export function buildYearRecap(
  year: number,
  activity: ShowActivity[],
  ratings: ShowRating[],
  watched: EpisodeWatched[],
  rewatches: ShowRewatch[],
): YearRecap {
  const finishedThisYear = activity.filter(
    (s) => s.finishedAt && !s.finishedAtUnknown && inYear(s.finishedAt, year),
  )
  const ratingsThisYear = ratings.filter((r) => inYear(r.rated_at, year))
  const watchedThisYear = watched.filter((w) => !w.watched_at_unknown && inYear(w.watched_at, year))
  const rewatchesThisYear = rewatches.filter((r) => inYear(r.rewatched_at, year))

  const avgRating =
    ratingsThisYear.length === 0
      ? null
      : ratingsThisYear.reduce((sum, r) => sum + r.rating, 0) / ratingsThisYear.length
  const topRated = ratingsThisYear.slice().sort((a, b) => b.rating - a.rating)[0] ?? null

  const monthCounts = new Map<string, number>()
  for (const w of watchedThisYear) {
    const key = new Date(w.watched_at).toLocaleDateString(undefined, { month: 'long' })
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
  }
  let mostActiveMonth: string | null = null
  let best = 0
  for (const [month, count] of monthCounts) {
    if (count > best) {
      mostActiveMonth = month
      best = count
    }
  }

  return {
    year,
    showsFinished: finishedThisYear.length,
    episodesWatched: watchedThisYear.length,
    hoursWatched: Math.round(watchedThisYear.reduce((sum, w) => sum + (w.runtime_minutes ?? 0), 0) / 60),
    ratingsGiven: ratingsThisYear.length,
    avgRating,
    topRated: topRated
      ? {
          showId: topRated.show_id,
          showName: topRated.show_name,
          showPosterPath: topRated.show_poster_path,
          rating: topRated.rating,
        }
      : null,
    mostActiveMonth,
    rewatches: rewatchesThisYear.length,
  }
}
