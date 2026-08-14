import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import SeasonTabs from '../components/SeasonTabs'
import EpisodeRow from '../components/EpisodeRow'
import { EpisodeRowSkeleton } from '../components/Skeletons'
import { backdropUrl, getSeasonDetail, getShowDetail, posterUrl, yearFromDate } from '../lib/tmdb'
import { deleteRating, fetchAllRatingsForShow, ratingKey, splitRatingsByUser, upsertRating } from '../lib/ratings'
import { useAuth } from '../contexts/AuthContext'
import type { CrowdMap, RatingMap, TmdbSeasonDetail, TmdbShowDetail } from '../types'

export default function ShowDetail() {
  const { id } = useParams<{ id: string }>()
  const showId = Number(id)
  const { user } = useAuth()

  const [show, setShow] = useState<TmdbShowDetail | null>(null)
  const [season, setSeason] = useState<TmdbSeasonDetail | null>(null)
  const [activeSeason, setActiveSeason] = useState<number | null>(null)
  const [ratings, setRatings] = useState<RatingMap>({})
  const [crowd, setCrowd] = useState<CrowdMap>({})
  const [loadingShow, setLoadingShow] = useState(true)
  const [loadingSeason, setLoadingSeason] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load show detail + everyone's ratings for this show (mine + the crowd's).
  useEffect(() => {
    let cancelled = false
    setLoadingShow(true)
    setError(null)

    async function load() {
      try {
        const [showData, allRatings] = await Promise.all([
          getShowDetail(showId),
          fetchAllRatingsForShow(showId),
        ])
        if (cancelled) return
        setShow(showData)
        const { mine, crowd: crowdMap } = splitRatingsByUser(allRatings, user?.id ?? '')
        setRatings(mine)
        setCrowd(crowdMap)
        const firstRealSeason = showData.seasons.find((s) => s.season_number > 0) ?? showData.seasons[0]
        setActiveSeason(firstRealSeason ? firstRealSeason.season_number : null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load show.')
      } finally {
        if (!cancelled) setLoadingShow(false)
      }
    }

    if (!Number.isNaN(showId)) load()
    return () => {
      cancelled = true
    }
  }, [showId, user])

  // Load episodes whenever the active season changes.
  useEffect(() => {
    if (activeSeason === null) return
    let cancelled = false
    setLoadingSeason(true)

    getSeasonDetail(showId, activeSeason)
      .then((data) => {
        if (!cancelled) setSeason(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load season.')
      })
      .finally(() => {
        if (!cancelled) setLoadingSeason(false)
      })

    return () => {
      cancelled = true
    }
  }, [showId, activeSeason])

  const seasonAverage = useMemo(() => {
    if (!season) return null
    const values = season.episodes
      .map((ep) => ratings[ratingKey(ep.season_number, ep.episode_number)]?.rating)
      .filter((v): v is number => typeof v === 'number' && v > 0)
    if (values.length === 0) return null
    return values.reduce((a, b) => a + b, 0) / values.length
  }, [season, ratings])

  async function handleRate(episodeNumber: number, episodeName: string, value: number) {
    if (!user || !show || activeSeason === null) return
    const key = ratingKey(activeSeason, episodeNumber)

    if (value === 0) {
      setRatings((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setCrowd((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).filter((r) => r.user_id !== user.id),
      }))
      await deleteRating(user.id, show.id, activeSeason, episodeNumber)
      return
    }

    const saved = await upsertRating({
      userId: user.id,
      showId: show.id,
      showName: show.name,
      showPosterPath: show.poster_path,
      seasonNumber: activeSeason,
      episodeNumber,
      episodeName,
      rating: value,
    })
    setRatings((prev) => ({ ...prev, [key]: saved }))
    setCrowd((prev) => {
      const existing = (prev[key] ?? []).filter((r) => r.user_id !== user.id)
      return { ...prev, [key]: [...existing, { ...saved, users: { username: user.username } }] }
    })
  }

  if (Number.isNaN(showId)) {
    return <p className="p-8 text-center text-sm text-red-400">Invalid show.</p>
  }

  if (error && !show) {
    return <p className="p-8 text-center text-sm text-red-400">{error}</p>
  }

  return (
    <div className="pb-24 md:pb-10">
      {/* Hero */}
      <div className="relative h-56 w-full overflow-hidden sm:h-72 md:h-80">
        {show?.backdrop_path ? (
          <img
            src={backdropUrl(show.backdrop_path) ?? undefined}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-base-850" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base-950 via-base-950/70 to-base-950/20" />
      </div>

      <div className="mx-auto -mt-20 max-w-5xl px-4 sm:-mt-24 sm:px-6">
        <div className="flex gap-4 sm:gap-6">
          <div className="w-28 shrink-0 overflow-hidden rounded-xl shadow-2xl shadow-black/50 ring-1 ring-white/10 sm:w-40">
            {show?.poster_path ? (
              <img src={posterUrl(show.poster_path) ?? undefined} alt={show.name} className="w-full" />
            ) : (
              <div className="aspect-[2/3] w-full bg-base-800" />
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="min-w-0 flex-1 self-end pb-1"
          >
            {loadingShow ? (
              <div className="animate-pulse space-y-2">
                <div className="h-6 w-2/3 rounded bg-base-800" />
                <div className="h-3 w-1/3 rounded bg-base-800" />
              </div>
            ) : (
              show && (
                <>
                  <h1 className="font-display text-xl font-semibold text-base-100 sm:text-3xl">
                    {show.name}
                  </h1>
                  <p className="mt-1 text-xs text-base-400 sm:text-sm">
                    {yearFromDate(show.first_air_date)} · {show.number_of_seasons} season
                    {show.number_of_seasons === 1 ? '' : 's'} · {show.status}
                  </p>
                </>
              )
            )}
          </motion.div>
        </div>

        {show?.overview && (
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-base-300">{show.overview}</p>
        )}

        {show?.genres && show.genres.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {show.genres.map((g) => (
              <span
                key={g.id}
                className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-base-400"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Seasons */}
        {show && show.seasons.length > 0 && activeSeason !== null && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <SeasonTabs seasons={show.seasons} active={activeSeason} onSelect={setActiveSeason} />
              {seasonAverage !== null && (
                <div className="hidden shrink-0 items-center gap-1.5 text-sm text-star sm:flex">
                  <StarGlyph />
                  {seasonAverage.toFixed(1)}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {loadingSeason
                ? Array.from({ length: 4 }).map((_, i) => <EpisodeRowSkeleton key={i} />)
                : season?.episodes.map((ep) => (
                    <EpisodeRow
                      key={ep.id}
                      episode={ep}
                      rating={ratings[ratingKey(ep.season_number, ep.episode_number)]?.rating ?? 0}
                      crowd={crowd[ratingKey(ep.season_number, ep.episode_number)] ?? []}
                      myUserId={user?.id ?? ''}
                      onRate={(value) => handleRate(ep.episode_number, ep.name, value)}
                    />
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-star)">
      <path d="M12 2.5l2.9 6.15 6.6.72-4.95 4.6 1.3 6.53L12 17.3l-5.85 3.2 1.3-6.53-4.95-4.6 6.6-.72L12 2.5z" />
    </svg>
  )
}
