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

  useEffect(() => {
    if (!username) return
    let cancelled = false
    setProfile(undefined)

    fetchUserByUsername(username).then((found) => {
      if (!cancelled) setProfile(found)
    })

    return () => {
      cancelled = true
    }
  }, [username])

  if (profile === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 text-center sm:px-6">
        <p className="text-sm text-base-500">No member found with username “{username}”.</p>
        <Link to="/members" className="mt-3 inline-block text-sm text-accent-400 hover:underline">
          &larr; Back to members
        </Link>
      </div>
    )
  }

  const isMe = me?.username === username

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <div className="mb-8 flex items-center justify-between">
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
        {isMe ? (
          <Link
            to="/profile"
            className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-base-300 transition-colors duration-200 hover:border-accent-500/40 hover:text-accent-400"
          >
            Edit / sign out
          </Link>
        ) : (
          <Link
            to={`/compare/${username}`}
            className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-base-300 transition-colors duration-200 hover:border-accent-500/40 hover:text-accent-400"
          >
            Compare ratings
          </Link>
        )}
      </div>

      {profile && <ProfileActivity userId={profile.id} username={profile.username} />}
    </div>
  )
}
