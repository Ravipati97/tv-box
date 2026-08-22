import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from '../contexts/ThemeContext'
import { scrollBehavior } from '../lib/motion'
import AppLogo from './AppLogo'
import ReportBugButton from './ReportBugButton'

const linkBase =
  'relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200 md:flex-row md:gap-1.5 md:text-sm md:px-3.5 md:py-1.5 md:rounded-full'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--color-accent-400)' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5v-7Z" fill={active ? 'var(--color-accent-400)' : 'currentColor'} stroke="none" />
    </svg>
  )
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--color-accent-400)' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

function ActivityIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--color-accent-400)' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 12.5h2l1.3-3.4 2 6.8 1.3-3.4h2.4" />
    </svg>
  )
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--color-accent-400)' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c1.2-3.4 4-5.2 6.5-5.2s5.3 1.8 6.5 5.2" />
      <path d="M16 8.2a3 3 0 1 1 3.2 3" />
      <path d="M15.5 14.9c2.1.3 4 1.8 4.9 5.1" />
    </svg>
  )
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--color-accent-400)' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a.6.6 0 0 0-.76-.76A9.7 9.7 0 1 0 21.26 15.26a.6.6 0 0 0-.76-.76Z" />
    </svg>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-base-400 transition-colors duration-200 hover:bg-hover hover:text-base-100"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -80, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 80, scale: 0.5 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

const NAV_ITEMS = [
  { to: '/home', label: 'Home', Icon: HomeIcon },
  { to: '/activity', label: 'Activity', Icon: ActivityIcon },
  { to: '/search', label: 'Search', Icon: SearchIcon },
  { to: '/members', label: 'Members', Icon: PeopleIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
] as const

export default function Navbar() {
  const location = useLocation()

  // React Router doesn't fire a navigation (no new history entry, no
  // location change) when a Link targets the route you're already on -- so
  // neither useScrollRestoration's location-keyed effect nor a plain
  // location.pathname effect ever runs for "tap the tab you're already on."
  // That's exactly the common case this was meant to cover (scrolled deep
  // into Home's grid, tap Home again to jump back to the top), so it needs
  // its own explicit handling here rather than relying on route-change
  // effects at all.
  function handleNavClick(to: string) {
    if (location.pathname === to) {
      window.scrollTo({ top: 0, left: 0, behavior: scrollBehavior() })
    }
  }

  return (
    <>
      {/* Top bar (always visible). pt-[env(safe-area-inset-top)] keeps the
          logo/theme-toggle clear of the iOS status bar + notch when the app
          is added to the home screen -- viewport-fit=cover (index.html) lets
          the page draw under that area, and black-translucent status-bar-style
          means nothing else pushes content down automatically. Sticky (not
          fixed) so the extra height is reserved in normal flow instead of
          needing a matching top-padding on every page's content below it. */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-base-950/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <NavLink to="/home" onClick={() => handleNavClick('/home')} className="flex items-center gap-2">
            <AppLogo size={24} />
            <span className="font-display text-lg font-semibold tracking-tight text-base-100">
              TV Box
            </span>
          </NavLink>

          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => handleNavClick(to)}
                  className={({ isActive }) =>
                    `${linkBase} ${
                      isActive
                        ? 'bg-accent-500/10 text-accent-300'
                        : 'text-base-400 hover:bg-hover hover:text-base-100'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon active={isActive} />
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            <ThemeToggle />
            {/* Last in this row on purpose: ReportBugPanel anchors itself
                with right-0 off its own trigger, so the trigger needs to be
                the actual rightmost element in the header for that math to
                land inside the viewport. With ThemeToggle after it instead,
                the panel's left edge went negative and got clipped by
                body's overflow-x: hidden on every phone-width screen. */}
            <ReportBugButton />
          </div>
        </div>
      </header>

      {/* Bottom tab bar (mobile only). Fixed position + backdrop-blur is a
          known combination for mobile Safari/Chrome to visibly desync from
          the viewport mid-scroll (the bar appears to lag or jump) -- forcing
          this onto its own GPU compositing layer up front, rather than
          promoting/demoting it dynamically as the page scrolls, is the
          standard fix. Also animates opacity only (no y-transform) on mount,
          so there's never a competing transform to reconcile with the
          static one below. */}
      <motion.nav
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-x-0 bottom-0 z-40 flex transform-gpu border-t border-hairline bg-base-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md will-change-transform md:hidden"
      >
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => handleNavClick(to)}
            className={({ isActive }) =>
              `${linkBase} flex-1 py-2.5 ${isActive ? 'text-accent-400' : 'text-base-400'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="mobile-tab-dot"
                    className="absolute top-0.5 h-1 w-1 rounded-full bg-accent-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
                <Icon active={isActive} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </motion.nav>
    </>
  )
}
