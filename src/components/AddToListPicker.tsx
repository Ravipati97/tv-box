import { useEffect, useState } from 'react'
import { addShowToList, createList, deleteList, fetchListsForUser, removeShowFromList } from '../lib/lists'
import Toast from './Toast'
import { useToast } from '../hooks/useToast'
import { useEscapeAndFocusReturn } from '../hooks/useEscapeAndFocusReturn'
import type { ShowListWithCount } from '../types'

/**
 * Small expandable panel for adding/removing a show from your lists, or
 * creating a new one on the spot -- same spirit as the streaming-platform
 * picker on this same page (ShowDetail.tsx), just for lists instead.
 */
export default function AddToListPicker({
  userId,
  showId,
  showName,
  showPosterPath,
  memberOf,
  onChange,
  onClose,
}: {
  userId: string
  showId: number
  showName: string
  showPosterPath: string | null
  memberOf: Set<string>
  onChange: (memberOf: Set<string>) => void
  onClose: () => void
}) {
  const [lists, setLists] = useState<ShowListWithCount[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  // Toast state (undo + error) is tied to this panel's own lifetime
  // (closing "Add to a list" dismisses it) rather than living at the page
  // level -- simpler, and the removal is still visible right there either way.
  const { toast, showUndo, showError, dismiss } = useToast()

  // Only ever mounted while open (ShowDetail conditionally renders it) --
  // "active" for the whole lifetime of this component instance.
  useEscapeAndFocusReturn(true, onClose)
  useEscapeAndFocusReturn(creating, () => setCreating(false))

  useEffect(() => {
    let cancelled = false
    fetchListsForUser(userId).then((data) => {
      if (!cancelled) setLists(data)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  async function handleToggle(listId: string) {
    setSavingId(listId)
    try {
      if (memberOf.has(listId)) {
        const removedList = lists?.find((l) => l.id === listId)
        try {
          await removeShowFromList(listId, showId)
        } catch {
          showError('Failed to remove from list. Try again.')
          return
        }
        const next = new Set(memberOf)
        next.delete(listId)
        onChange(next)
        setLists((prev) => prev?.map((l) => (l.id === listId ? { ...l, itemCount: l.itemCount - 1 } : l)) ?? prev)
        if (removedList) {
          showUndo(`Removed from "${removedList.name}"`, () => handleUndoRemove(listId))
        }
      } else {
        try {
          await addShowToList({ listId, showId, showName, showPosterPath })
        } catch {
          showError('Failed to add to list. Try again.')
          return
        }
        const next = new Set(memberOf)
        next.add(listId)
        onChange(next)
        setLists((prev) => prev?.map((l) => (l.id === listId ? { ...l, itemCount: l.itemCount + 1 } : l)) ?? prev)
      }
    } finally {
      setSavingId(null)
    }
  }

  async function handleUndoRemove(listId: string) {
    setSavingId(listId)
    try {
      await addShowToList({ listId, showId, showName, showPosterPath })
      const next = new Set(memberOf)
      next.add(listId)
      onChange(next)
      setLists((prev) => prev?.map((l) => (l.id === listId ? { ...l, itemCount: l.itemCount + 1 } : l)) ?? prev)
    } catch {
      showError('Failed to undo. Try adding it back manually.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setSavingId('new')
    try {
      const list = await createList(userId, name)
      try {
        await addShowToList({ listId: list.id, showId, showName, showPosterPath })
      } catch {
        // The list itself was created but the show didn't make it on -- an
        // empty orphan list nobody asked for is worse than just retrying the
        // whole thing, so clean it up rather than leaving it behind.
        await deleteList(list.id).catch(() => {})
        throw new Error('add-to-new-list-failed')
      }
      setLists((prev) => [{ ...list, itemCount: 1 }, ...(prev ?? [])])
      onChange(new Set([...memberOf, list.id]))
      setNewName('')
      setCreating(false)
    } catch {
      showError('Failed to create list. Try again.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <div className="mt-2 rounded-xl border border-hairline-strong bg-base-900 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-base-300">Add to a list</p>
          <button type="button" onClick={onClose} className="text-xs text-base-500 hover:text-base-300">
            Close
          </button>
        </div>

        <div className="mt-2 max-h-56 overflow-y-auto">
          {lists === null ? (
            <p className="px-1 py-2 text-xs text-base-500">Loading your lists…</p>
          ) : lists.length === 0 ? (
            <p className="px-1 py-2 text-xs text-base-500">No lists yet -- create your first one below.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  disabled={savingId === list.id}
                  onClick={() => handleToggle(list.id)}
                  className="flex items-center justify-between rounded-lg px-1.5 py-1.5 text-left text-xs text-base-200 transition-colors duration-150 hover:bg-hover disabled:opacity-50"
                >
                  <span className="truncate">
                    {list.name} <span className="text-base-500">· {list.itemCount}</span>
                  </span>
                  <span className={`shrink-0 ${memberOf.has(list.id) ? 'text-accent-400' : 'text-base-600'}`}>
                    {memberOf.has(list.id) ? '✓ Added' : 'Add'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCreate()
            }}
            className="mt-2 flex items-center gap-1.5"
          >
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="List name"
              className="w-full rounded-lg border border-hairline-strong bg-base-950 px-2.5 py-1.5 text-xs text-base-200 placeholder:text-base-600"
            />
            <button
              type="submit"
              disabled={!newName.trim() || savingId === 'new'}
              className="shrink-0 rounded-lg bg-accent-500/15 px-2.5 py-1.5 text-xs font-medium text-accent-300 ring-1 ring-accent-500/40 disabled:opacity-50"
            >
              Create
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-2 text-xs text-accent-400 hover:underline"
          >
            + New list
          </button>
        )}
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} action={toast.action} onDismiss={dismiss} />}
    </>
  )
}
