import { useEffect, useRef } from 'react'

/**
 * Escape-to-close and focus-return-to-trigger for an inline toggled panel.
 * This app has no true modals anywhere (no role="dialog", no keydown
 * listeners at all before this) -- just conditionally-shown panels like
 * AddToListPicker, the streaming provider picker, and various inline
 * confirm/create forms, all of which previously ignored Escape and left
 * focus wherever it happened to be after the panel disappeared.
 *
 * Captures whatever element had focus at the moment the panel opens (almost
 * always the button that triggered it) and restores focus there on close,
 * whether that close came from Escape, a Cancel/Close button, or a
 * successful action that closes the panel itself.
 */
export function useEscapeAndFocusReturn(active: boolean, onClose: () => void) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!active) return
    triggerRef.current = document.activeElement as HTMLElement | null

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus?.()
    }
  }, [active])
}
