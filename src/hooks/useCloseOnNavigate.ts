import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Closes an always-mounted top-bar dropdown (NotificationsBell, ReportBugButton)
 * when the route changes. Navbar renders once for the whole session rather
 * than per-page (see App.tsx -- it sits above the route-keyed <Routes>), so
 * without this, leaving one of these panels open and then tapping a nav
 * link leaves it floating over whatever page loads next instead of closing
 * the way a fresh page load would implicitly reset it.
 */
export function useCloseOnNavigate(onClose: () => void) {
  const location = useLocation()
  useEffect(() => {
    onClose()
    // Only the pathname change should trigger this -- onClose is a fresh
    // closure every render (usually `() => setOpen(false)`), not something
    // that should itself retrigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
}
