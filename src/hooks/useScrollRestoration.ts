import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollBehavior } from '../lib/motion'

const STORAGE_PREFIX = 'scrollpos:'

// Async-loaded pages (almost all of them -- see App.tsx's lazy() pages)
// start short and grow as data arrives, so a single scrollTo on mount often
// can't reach the saved position yet. Retrying on every animation frame,
// for up to this many frames (~1s at 60fps), gives the page's data fetch
// and AnimatePresence's exit/enter transition time to finish before giving
// up on an exact restore.
const RESTORE_ATTEMPTS = 60

/**
 * Restores scroll position on back/forward navigation (POP), and resets to
 * the top on any other navigation (PUSH/REPLACE -- i.e. clicking a link or
 * a nav item, already the expected behavior). Positions are saved
 * continuously per history entry (location.key, from react-router -- unique
 * per entry, unlike pathname, which repeats every time you revisit the same
 * route) so browsing deep into a list, opening a show, then hitting back
 * lands you back where you were instead of at the top of the list again.
 *
 * Call once, at the app shell level -- this tracks window/document scroll,
 * not anything page-local.
 */
export function useScrollRestoration() {
  const location = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    if (navType !== 'POP') {
      // Smooth here -- this is the common "tapped a nav item" case, and
      // should feel like an animated glide, not a jarring snap. The POP
      // restore below stays instant on purpose: it calls scrollTo up to 60
      // times while content is still loading in, and animating each of
      // those would fight itself into a stutter instead of landing cleanly.
      window.scrollTo({ top: 0, left: 0, behavior: scrollBehavior() })
      return
    }
    const raw = sessionStorage.getItem(STORAGE_PREFIX + location.key)
    const target = raw !== null ? Number(raw) : 0
    let attempts = 0
    let cancelled = false
    let frame = 0

    function tryRestore() {
      if (cancelled) return
      attempts++
      window.scrollTo(0, target)
      const closeEnough = Math.abs(window.scrollY - target) < 4
      const tallEnough = document.documentElement.scrollHeight - window.innerHeight >= target - 4
      if (!closeEnough && !tallEnough && attempts < RESTORE_ATTEMPTS) {
        frame = requestAnimationFrame(tryRestore)
      }
    }
    tryRestore()

    return () => {
      cancelled = true
      if (frame) cancelAnimationFrame(frame)
    }
  }, [location.pathname, location.key, navType])

  useEffect(() => {
    // rAF-throttled so a scroll gesture (which can fire dozens of events per
    // second) writes to sessionStorage at most once per frame, not on every
    // single scroll event.
    let ticking = false
    function saveScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        sessionStorage.setItem(STORAGE_PREFIX + location.key, String(window.scrollY))
        ticking = false
      })
    }
    window.addEventListener('scroll', saveScroll, { passive: true })
    return () => window.removeEventListener('scroll', saveScroll)
  }, [location.key])
}
