import { useCallback, useState } from 'react'
import type { ToastAction } from '../components/Toast'

export interface ToastState {
  message: string
  tone: 'info' | 'error'
  action?: ToastAction
}

/**
 * One toast slot per page/component, shared by every mutating action on it.
 * showUndo/showError both funnel into the same slot -- a second toast
 * naturally replaces an earlier, un-actioned one rather than stacking, which
 * also means an error toast will cover over a stale, no-longer-relevant
 * undo offer if one somehow overlaps with another action failing.
 *
 * `onUndo` should do its own try/catch and call `showError` on failure --
 * this hook doesn't guess at how to report an undo that itself failed.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showUndo = useCallback((message: string, onUndo: () => void) => {
    // Dismiss immediately on click, don't wait for the auto-dismiss timer --
    // otherwise the toast (and a second, accidental click on "Undo") lingers
    // for however long is left of the 8s window.
    setToast({
      message,
      tone: 'info',
      action: {
        label: 'Undo',
        onClick: () => {
          setToast(null)
          onUndo()
        },
      },
    })
  }, [])

  const showError = useCallback((message: string) => {
    setToast({ message, tone: 'error' })
  }, [])

  const dismiss = useCallback(() => setToast(null), [])

  return { toast, showUndo, showError, dismiss }
}
