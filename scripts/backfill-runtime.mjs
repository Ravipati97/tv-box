#!/usr/bin/env node
// One-off backfill for episode_watched.runtime_minutes on rows logged
// before that column existed, so "Hours watched" on Profile is accurate
// for older history instead of showing 0 until new episodes get marked.
//
// NOT run automatically by anything -- this repo's build/CI never touches
// it. Run it yourself, once, whenever you're ready. Either:
//
//   node --env-file=.env.local scripts/backfill-runtime.mjs
//
// or, since this file has a shebang, make it executable once and run it
// directly (still needs the env vars, e.g. via `set -a; source .env.local; set +a` first):
//
//   chmod +x scripts/backfill-runtime.mjs
//   ./scripts/backfill-runtime.mjs
//
// (or export VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_TMDB_API_KEY
// yourself first -- same variable names as .env.local.)
//
// Safe to re-run: it only touches rows where runtime_minutes is still
// null, and leaves a row null (rather than guessing) if TMDB doesn't have
// a runtime for that episode.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TMDB_API_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_TMDB_API_KEY.')
  console.error('Run with: node --env-file=.env.local scripts/backfill-runtime.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function tmdbEpisodeRuntimes(showId, seasonNumber) {
  const url = `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB ${res.status} for show ${showId} season ${seasonNumber}`)
  const data = await res.json()
  const byEpisode = new Map()
  for (const ep of data.episodes ?? []) {
    byEpisode.set(ep.episode_number, ep.runtime ?? null)
  }
  return byEpisode
}

async function main() {
  const { data: rows, error } = await supabase
    .from('episode_watched')
    .select('id, show_id, season_number, episode_number')
    .is('runtime_minutes', null)

  if (error) throw error
  if (!rows || rows.length === 0) {
    console.log('Nothing to backfill -- every row already has a runtime.')
    return
  }

  console.log(`${rows.length} row(s) missing runtime_minutes.`)

  // Group by show+season so each TMDB season is fetched once, not once per episode.
  const bySeason = new Map()
  for (const row of rows) {
    const key = `${row.show_id}:${row.season_number}`
    if (!bySeason.has(key)) bySeason.set(key, [])
    bySeason.get(key).push(row)
  }

  let updated = 0
  let skipped = 0
  for (const [key, seasonRows] of bySeason) {
    const [showId, seasonNumber] = key.split(':').map(Number)
    let runtimes
    try {
      runtimes = await tmdbEpisodeRuntimes(showId, seasonNumber)
    } catch (err) {
      console.warn(`Skipping show ${showId} season ${seasonNumber}: ${err.message}`)
      skipped += seasonRows.length
      continue
    }
    for (const row of seasonRows) {
      const runtime = runtimes.get(row.episode_number)
      if (runtime == null) {
        skipped++
        continue
      }
      const { error: updateError } = await supabase
        .from('episode_watched')
        .update({ runtime_minutes: runtime })
        .eq('id', row.id)
      if (updateError) {
        console.warn(`Failed to update row ${row.id}: ${updateError.message}`)
        skipped++
      } else {
        updated++
      }
    }
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped} (no TMDB runtime available).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
