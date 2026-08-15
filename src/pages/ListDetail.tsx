import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchUserByUsername } from '../lib/users'
import { deleteList, fetchList, fetchListItems, removeShowFromList } from '../lib/lists'
import { posterUrl } from '../lib/tmdb'
import type { AppUser, ShowList, ShowListItem } from '../types'

export default function ListDetail() {
  const { username, listId } = useParams<{ username: string; listId: string }>()
  const { user: me } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined)
  const [list, setList] = useState<ShowList | null | undefined>(undefined)
  const [items, setItems] = useState<ShowListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!username || !listId) return
    let cancelled = false
    setLoading(true)
    Promise.all([fetchUserByUsername(username), fetchList(listId), fetchListItems(listId)])
      .then(([userRow, listRow, itemRows]) => {
        if (cancelled) return
        setProfile(userRow)
        setList(listRow)
        setItems(itemRows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [username, listId])

  const isMine = Boolean(me && profile && me.id === profile.id)

  async function handleRemove(showId: number) {
    if (!listId) return
    setItems((prev) => prev.filter((i) => i.show_id !== showId))
    await removeShowFromList(listId, showId)
  }

  async function handleDeleteList() {
    if (!listId || !username) return
    await deleteList(listId)
    navigate(`/u/${username}`)
  }

  if (!loading && (profile === null || list === null)) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 text-center sm:px-6">
        <p className="text-sm text-base-500">List not found.</p>
        <Link to="/members" className="mt-3 inline-block text-sm text-accent-400 hover:underline">
          &larr; Back to members
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
      <Link to={`/u/${username}`} className="mb-4 inline-block text-xs text-base-500 hover:text-base-300">
        &larr; {isMine ? 'Your' : `@${username}'s`} lists
      </Link>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-6 w-48 rounded bg-base-800" />
          <div className="h-3 w-64 rounded bg-base-800" />
        </div>
      ) : (
        list && (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-display text-xl font-semibold text-base-100 sm:text-2xl"
                >
                  {list.name}
                </motion.h1>
                {list.description && <p className="mt-1 text-sm text-base-400">{list.description}</p>}
                <p className="mt-1 text-xs text-base-500">
                  {items.length} show{items.length === 1 ? '' : 's'}
                </p>
              </div>
              {isMine && (
                <button
                  type="button"
                  onClick={handleDeleteList}
                  className="shrink-0 rounded-lg border border-hairline-strong px-3 py-1.5 text-xs text-base-400 transition-colors duration-200 hover:border-danger/40 hover:text-danger"
                >
                  Delete list
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="mt-10 flex flex-col items-center rounded-2xl border border-hairline bg-base-850/40 px-6 py-14 text-center">
                <div className="mb-3 text-4xl">📋</div>
                <p className="max-w-xs text-sm text-base-500">
                  Nothing on this list yet. Add shows from any show&apos;s page.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {items.map((item) => (
                  <div key={item.id} className="group relative">
                    <Link to={`/show/${item.show_id}`} className="block">
                      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-base-800 ring-1 ring-hairline transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.35)]">
                        {item.show_poster_path ? (
                          <img
                            src={posterUrl(item.show_poster_path) ?? undefined}
                            alt={item.show_name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-base-400">
                            {item.show_name}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 truncate text-sm font-medium text-base-100">{item.show_name}</p>
                    </Link>
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleRemove(item.show_id)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
                        aria-label={`Remove ${item.show_name} from this list`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}
