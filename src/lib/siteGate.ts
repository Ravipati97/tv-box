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
  return localStorage.getItem(GATE_STORAGE_KEY) === '1'
}

export function markGatePassed(): void {
  localStorage.setItem(GATE_STORAGE_KEY, '1')
}

export function checkPasscode(input: string): boolean {
  if (!expectedPasscode) return true
  return input.trim() === expectedPasscode
}
