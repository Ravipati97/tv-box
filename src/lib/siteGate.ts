// A shared passcode that stands between a stranger with the URL and the
// login/registration screen. This is NOT real security: since the site is
// static (no server), VITE_SITE_PASSCODE is baked into the public JS bundle
// at build time and anyone determined could read it out of the source.
// It's a soft deterrent -- keeps search-engine crawlers, link-sharing
// accidents, and casual visitors from landing on a sign-up form -- not a
// lock for anything sensitive. Consistent with the rest of the app's
// no-real-auth model (see AuthContext).

const GATE_STORAGE_KEY = 'tvbox_gate_ok'

const expectedPasscode = import.meta.env.VITE_SITE_PASSCODE?.trim()

export const isGateConfigured = Boolean(expectedPasscode)

export function hasPassedGate(): boolean {
  // Fails closed (treated as "not passed yet") if storage access itself
  // throws -- Safari private browsing and similar restricted contexts --
  // same reasoning as AuthContext's readStoredUser: this runs during the
  // very first render, so an uncaught throw here would take the whole app
  // down before there's anything on screen to recover from.
  try {
    return localStorage.getItem(GATE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markGatePassed(): void {
  try {
    localStorage.setItem(GATE_STORAGE_KEY, '1')
  } catch {
    // Worst case they just see the passcode gate again next visit.
  }
}

export function checkPasscode(input: string): boolean {
  if (!expectedPasscode) return true
  return input.trim() === expectedPasscode
}
