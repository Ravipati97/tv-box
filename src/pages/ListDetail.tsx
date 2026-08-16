import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { fetchUserByUsername } from '../lib/users'
import { addShowToList, deleteList, fetchList, fetchListItems, removeShowFromList } from '../lib/lists'
import { posterUrl } from '../lib/tmdb'
import Toast from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'
import type { AppUser, ShowList, ShowListItem } from '../types'

export default function ListDetail() {
  const { username, listId } = useParams<{ username: string; listId: string }>()
  const { user: me } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined)
  const [list, setList] = useState<ShowList | null | undefined>(undefined)
  const [items, setItems] = useState<ShowListItem[]>([])
  const [loading, setLoading] = useState(true)
  // Deleting a list is permanent and takes every item on it with it -- an
  // inline "are you sure" step (no native confirm(), same reasoning as
  // DateMarkControl) is the guard against one mis-tap wiping it out.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast, showUndo, showError, dismiss } = useToast()

  useEscapeAndFocusReturn(confirmingDelete, () => setConfirmingDelete(false))

  useEffect(() => {
    if (!username || !listId) return
    let cancelled = false
    setLoading(true)
    Promise.all([fetchUserByUsername(username), fetchList(listId), fetchListItems(listId)])
      .then(([userRow, listRow, itemRows]) => {
        if (cancelled) return
        setProfile(userRow)
        // A list's URL is scoped to a username, but listId is looked up on
        // its own -- without this check, a mismatched URL (list from one
        // user's page, ID from another's) would render as if it belonged to
        // the wrong owner, and that owner's "isMine" controls (delete list,
        // remove show) would act on someone else's list.
        if (listRow && userRow && listRow.user_id !== userRow.id) {
          setList(null)
          setItems([])
          return
        }
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

  async function handleRemove(item: ShowListItem) {
    if (!listId) return
    setItems((prev) => prev.filter((i) => i.show_id !== item.show_id))
    try {
      await removeShowFromList(listId, item.show_id)
    } catch {
      setItems((prev) => [item, ...prev])
      showError(`Failed to remove ${item.show_name}. Try again.`)
      return
    }
    // The × button sits right next to the poster with no separate confirm
    // step, so a mis-tap is easy -- give it the same recoverable undo as
    // every other removal in the app instead of a silent, permanent drop.
    showUndo(`Removed ${item.show_name} from this list`, async () => {
      if (!listId) return
      try {
        const saved = await addShowToList({
          listId,
          showId: item.show_id,
          showName: item.show_name,
          showPosterPath: item.show_poster_path,
        })
        setItems((prev) => [saved, ...prev])
      } catch {
        showError('Failed to undo. Try adding it back manually.')
      }
    })
  }

  async function handleDeleteList() {
    if (!listId || !username) return
    setDeleting(true)
    try {
      await deleteList(listId)
      navigate(`/u/${username}`)
    } catch {
      setDeleting(false)
      setConfirmingDelete(false)
      showError('Failed to delete this list. Try again.')
    }
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
              {isMine &&
                (confirmingDelete ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs text-base-500">Delete this list?</span>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDeleteList}
                      className="rounded-lg bg-danger/15 px-2.5 py-1.5 text-xs font-medium text-danger ring-1 ring-danger/40 transition-opacity duration-150 disabled:opacity-60"
                    >
                      {deleting ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmingDelete(false)}
                      className="text-xs text-base-500 hover:text-base-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="shrink-0 rounded-lg border border-hairline-strong px-3 py-1.5 text-xs text-base-400 transition-colors duration-200 hover:border-danger/40 hover:text-danger"
                  >
                    Delete list
                  </button>
                ))}
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
                        onClick={() => handleRemove(item)}
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

      {toast && <Toast message={toast.message} tone={toast.tone} action={toast.action} onDismiss={dismiss} />}
    </div>
  )
}
