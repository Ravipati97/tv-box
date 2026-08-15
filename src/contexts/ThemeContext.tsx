import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tvbox-theme'
const THEME_COLOR = { dark: '#08080c', light: '#f8fafc' } as const

/** The boot script in index.html already applied the right class before
 * first paint -- read it back rather than re-deriving it, so there's no
 * chance of a mismatched flash between the two. */
function getInitialTheme(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) {
    return 'light'
  }
  return 'dark'
}

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)

    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', THEME_COLOR[theme])

    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Private browsing / storage disabled -- theme just won't persist.
    }
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
