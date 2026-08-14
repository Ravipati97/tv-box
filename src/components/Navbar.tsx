import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'

const linkBase =
  'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200 md:flex-row md:gap-1.5 md:text-sm md:px-3 md:py-1.5 md:rounded-full'

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

export default function Navbar() {
  return (
    <>
      {/* Top bar (always visible) */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-base-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <NavLink to="/search" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--color-accent-500)" />
              <rect x="6" y="9" width="20" height="14" rx="3" fill="var(--color-base-950)" />
              <path d="M15 14.5L19 16.5L15 18.5V14.5Z" fill="var(--color-star)" />
            </svg>
            <span className="font-display text-lg font-semibold tracking-tight text-base-100">
              TV Box
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink
              to="/search"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-white/5 text-base-100' : 'text-base-400 hover:text-base-100'}`
              }
            >
              {({ isActive }) => (
                <>
                  <SearchIcon active={isActive} />
                  Search
                </>
              )}
            </NavLink>
            <NavLink
              to="/members"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-white/5 text-base-100' : 'text-base-400 hover:text-base-100'}`
              }
            >
              {({ isActive }) => (
                <>
                  <PeopleIcon active={isActive} />
                  Members
                </>
              )}
            </NavLink>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'bg-white/5 text-base-100' : 'text-base-400 hover:text-base-100'}`
              }
            >
              {({ isActive }) => (
                <>
                  <UserIcon active={isActive} />
                  Profile
                </>
              )}
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Bottom tab bar (mobile only) */}
      <motion.nav
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/5 bg-base-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `${linkBase} flex-1 py-2.5 ${isActive ? 'text-base-100' : 'text-base-400'}`
          }
        >
          {({ isActive }) => (
            <>
              <SearchIcon active={isActive} />
              Search
            </>
          )}
        </NavLink>
        <NavLink
          to="/members"
          className={({ isActive }) =>
            `${linkBase} flex-1 py-2.5 ${isActive ? 'text-base-100' : 'text-base-400'}`
          }
        >
          {({ isActive }) => (
            <>
              <PeopleIcon active={isActive} />
              Members
            </>
          )}
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `${linkBase} flex-1 py-2.5 ${isActive ? 'text-base-100' : 'text-base-400'}`
          }
        >
          {({ isActive }) => (
            <>
              <UserIcon active={isActive} />
              Profile
            </>
          )}
        </NavLink>
      </motion.nav>
    </>
  )
}
