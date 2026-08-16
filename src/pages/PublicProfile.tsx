import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchUserByUsername } from '../lib/users'
import ProfileActivity from '../components/ProfileActivity'
import type { AppUser } from '../types'

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const { user: me } = useAuth()
  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined) // undefined = loading
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username) return
    let cancelled = false
    setProfile(undefined)
    setError(null)

    fetchUserByUsername(username)
      .then((found) => {
        if (!cancelled) setProfile(found)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load this member.')
      })

    return () => {
      cancelled = true
    }
  }, [username])

  if (error || profile === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 text-center sm:px-6">
        <p className="text-sm text-base-500">
          {error ?? `No member found with username “${username}”.`}
        </p>
        <Link to="/members" className="mt-3 inline-block text-sm text-accent-400 hover:underline">
          &larr; Back to members
        </Link>
      </div>
    )
  }

  const isMe = me?.username === username

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-base font-semibold text-accent-300 ring-1 ring-accent-500/20">
            {profile === undefined ? '' : profile.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-base-500">
              {isMe ? 'This is you' : 'Member'}
            </p>
            {profile === undefined ? (
              <div className="mt-1 h-6 w-32 animate-pulse rounded bg-base-800" />
            ) : (
              <h1 className="font-display text-lg font-semibold text-base-100 sm:text-xl">
                @{profile.username}
              </h1>
            )}
          </div>
        </div>
        {isMe ? (
          <Link
            to="/profile"
            className="rounded-lg border border-hairline-strong px-3.5 py-2 text-sm text-base-300 transition-colors duration-200 hover:border-accent-500/40 hover:text-accent-400"
          >
            Edit / sign out
          </Link>
        ) : (
          <Link
            to={`/compare/${username}`}
            className="rounded-lg border border-hairline-strong px-3.5 py-2 text-sm text-base-300 transition-colors duration-200 hover:border-accent-500/40 hover:text-accent-400"
          >
            Compare ratings
          </Link>
        )}
      </div>

      {profile && <ProfileActivity userId={profile.id} username={profile.username} />}
    </div>
  )
}
