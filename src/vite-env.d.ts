/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_TMDB_API_KEY: string
  readonly VITE_SITE_PASSCODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Inlined at build time from package.json's version -- see vite.config.ts. */
declare const __APP_VERSION__: string
