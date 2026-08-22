import { useEffect, useRef } from 'react'

/**
 * Focuses the input when `active` becomes true, but only on devices with a
 * precise pointer (i.e. desktop with a mouse). Auto-focusing on touch
 * devices pops the on-screen keyboard immediately, which on mobile browsers
 * can cause the layout to shift/zoom unexpectedly before the user has done
 * anything -- so we skip it there and let people tap in themselves.
 *
 * Originally private to Login.tsx; shared here once ReportBugButton needed
 * the same behavior for its own text input.
 */
export function useDesktopAutoFocus(active: boolean) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (window.matchMedia('(pointer: fine)').matches) {
      ref.current?.focus()
    }
  }, [active])
  return ref
}
