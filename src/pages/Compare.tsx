import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchRecentShowRatings } from '../lib/showRatings'
import { fetchUserByUsername } from '../lib/users'
import { posterUrl } from '../lib/tmdb'
import CenteredMessage from '../components/CenteredMessage'
import type { AppUser, ShowRating } from '../types'

interface SharedShow {
  showId: number
  showName: string
  showPosterPath: string | null
  mine: number
  theirs: number
  diff: number
}

export default function Compare() {
  const { username } = useParams<{ username: string }>()
  const { user: me } = useAuth()
  const [them, setThem] = useState<AppUser | null | undefined>(undefined) // undefined = loading
  const [myRatings, setMyRatings] = useState<ShowRating[]>([])
  const [theirRatings, setTheirRatings] = useState<ShowRating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username || !me) return
    let cancelled = false
    setThem(undefined)
    setLoading(true)

    fetchUserByUsername(username)
      .then(async (found) => {
        if (cancelled) return
        setThem(found)
        if (found) {
          const [mine, theirs] = await Promise.all([
            fetchRecentShowRatings(me.id, 5000),
            fetchRecentShowRatings(found.id, 5000),
          ])
          if (!cancelled) {
            setMyRatings(mine)
            setTheirRatings(theirs)
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load comparison.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [username, me])

  const { shared, matchPercent } = useMemo(() => {
    const theirMap = new Map(theirRatings.map((r) => [r.show_id, r]))
    const rows: SharedShow[] = []
    for (const mine of myRatings) {
      const theirs = theirMap.get(mine.show_id)
      if (!theirs) continue
      const diff = Math.abs(mine.rating - theirs.rating)
      rows.push({
        showId: mine.show_id,
        showName: mine.show_name,
        showPosterPath: mine.show_poster_path,
        mine: mine.rating,
        theirs: theirs.rating,
        diff,
      })
    }
    rows.sort((a, b) => b.diff - a.diff)

    const match =
      rows.length === 0
        ? null
        : Math.round(
            (rows.reduce((sum, r) => sum + (1 - Math.min(r.diff / 4.5, 1)), 0) / rows.length) * 100,
          )

    return { shared: rows, matchPercent: match }
  }, [myRatings, theirRatings])

  if (them === null) {
    return <CenteredMessage message={`No member found with username “${username}”.`} />
  }

  if (me && username === me.username) {
    return <CenteredMessage message="You can't compare with yourself." />
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display mb-1 text-2xl font-semibold text-base-100"
      >
        You vs @{username}
      </motion.h1>
      <p className="mb-6 text-sm text-base-500">How your ratings stack up on shows you&apos;ve both rated.</p>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-base-850/70" />
          ))}
        </div>
      ) : shared.length === 0 ? (
        <p className="mt-10 text-center text-sm text-base-500">
          No overlap yet — you haven&apos;t rated any of the same shows.
        </p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3">
            <StatCard label="Taste match" value={matchPercent !== null ? `${matchPercent}%` : '—'} />
            <StatCard label="Shows in common" value={shared.length} />
          </div>

          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-400">
            Biggest differences first
          </h2>
          <ul className="space-y-2">
            {shared.map((r, i) => (
              <motion.li
                key={r.showId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}
              >
                <Link
                  to={`/show/${r.showId}`}
                  className="flex items-center gap-3 rounded-xl border border-hairline bg-base-850/60 p-2.5 transition-colors duration-200 hover:bg-base-800/70"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-base-800">
                    {r.showPosterPath && (
                      <img
                        src={posterUrl(r.showPosterPath, 'w185') ?? undefined}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-base-100">{r.showName}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className="rounded-md bg-hover-strong px-1.5 py-1 text-base-200">
                      You {r.mine.toFixed(1)}
                    </span>
                    <span className="rounded-md bg-hover-strong px-1.5 py-1 text-base-200">
                      @{username} {r.theirs.toFixed(1)}
                    </span>
                  </div>
                </Link>
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-hairline bg-base-850/60 p-3.5 text-center">
      <p className="text-lg font-semibold text-base-100 sm:text-xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-base-500">{label}</p>
    </div>
  )
}
