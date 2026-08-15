import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ProfileActivity from '../components/ProfileActivity'

export default function Profile() {
  const { user, signOut } = useAuth()

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-base font-semibold text-accent-300 ring-1 ring-accent-500/20">
            {user?.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-base-500">Signed in as</p>
            <h1 className="font-display text-lg font-semibold text-base-100 sm:text-xl">
              @{user?.username}
            </h1>
            <p className="text-xs text-base-500">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/recap"
            className="rounded-lg border border-hairline-strong px-3.5 py-2 text-sm text-base-300 transition-colors duration-200 hover:border-accent-500/40 hover:text-accent-400"
          >
            Year in review
          </Link>
          <Link
            to={`/u/${user?.username}`}
            className="rounded-lg border border-hairline-strong px-3.5 py-2 text-sm text-base-300 transition-colors duration-200 hover:border-accent-500/40 hover:text-accent-400"
          >
            Public view
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-hairline-strong px-3.5 py-2 text-sm text-base-300 transition-colors duration-200 hover:border-danger/40 hover:text-danger"
          >
            Sign out
          </button>
        </div>
      </div>

      {user && <ProfileActivity userId={user.id} username={user.username} />}
    </div>
  )
}
