# TV Box — Feature Scoping

Seven features scoped below: watchlist, undo/confirmation on bulk mark-watched actions, new-episode awareness, rewatches, total watch-time, custom lists, and a yearly recap. Written reviews and discovery/browse are intentionally out of scope for now.

Context that shapes every estimate here: TV Box is a static SPA (GitHub Pages) talking directly to Supabase (Postgres, permissive RLS, no real auth) and TMDB (called client-side). There is no backend server, no cron, no scheduled functions today — everything runs in the browser on demand. That's fine for data-model and UI work, but it means anything requiring a scheduled check-in (see New-episode awareness below) is a different category of effort from the rest of this list.

Effort sizes are relative to features already shipped in this repo: season ratings and the streaming-badge system were each **M**; the unreleased-episode guard added this session was **S**.

---

## 1. Undo / confirmation on bulk mark-watched actions

**Why first:** this is the one directly motivated by a real incident — "Mark it all watched" silently overwrote the `watched_at` on already-watched episodes during testing, with no way back. It's also the only item here with zero schema changes, so it's the cheapest fix on the list.

**Data model:** none. This is entirely client-side.

**UI:**
- `DateMarkControl.tsx` (or a variant of it) needs to show what a bulk action will actually do before the Confirm tap does it — specifically, warn when some of the targeted episodes are *already* watched and will have their date overwritten. `handleMarkSeasonWatched` and `handleMarkAllWatched` in `ShowDetail.tsx` already have the full episode list and the current `watched` map in scope, so computing "N new, M overwritten" before calling `bulkMarkWatched` is straightforward.
- A short-lived "Undo" affordance after the mutation completes: snapshot the affected rows from the `watched` state *before* the bulk write, then on Undo, restore the ones that existed (re-upsert their original `watched_at`/`watched_at_unknown`) and delete the ones that didn't (via `unmarkWatched`). This needs a small toast/snackbar component, which doesn't exist yet anywhere in the app.
- No native `confirm()` — stays consistent with the existing convention (the inline expand + Confirm tap already *is* the confirmation step; this just makes the copy inside it honest about consequences).

**Effort: S–M.** No schema, touches one page and one shared control, plus one new small component (toast).

---

## 2. Watchlist ("want to watch")

**Data model:** new table, same shape as `show_ratings`/`episode_watched` (denormalized show name/poster so lists never need an extra TMDB call):

```sql
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  show_id integer not null,
  show_name text not null,
  show_poster_path text,
  added_at timestamptz not null default now(),
  unique (user_id, show_id)
);
```
Same permissive RLS pattern as every other table in `schema.sql`.

**UI:**
- `lib/watchlist.ts` — `fetchWatchlist`, `addToWatchlist`, `removeFromWatchlist`, mirroring `showRatings.ts`.
- `ShowDetail.tsx` — a toggle ("Add to watchlist" / "On your watchlist") next to "Start watching," shown only while `watchedCount === 0` (once you've started, it's not "want to watch" anymore).
- A `Watchlist` tab alongside the existing Diary/History tabs on `Profile.tsx` — reuses the `ShowCard` grid already used on Search/Home.

**Effort: S–M.** Directly comparable to season ratings — one table, one lib file, one toggle, one grid.

---

## 3. Rewatches

**Product decision needed first:** full per-episode rewatch tracking (multiple watched-dates per episode) vs. a lighter show-level "I rewatched this" log entry.

Full per-episode tracking means dropping or reworking the `unique(user_id, show_id, season_number, episode_number)` constraint on `episode_watched`, which is also what "12/24 watched" and "finished" currently key off of (`showActivity.ts`). That's a real rework of the progress math, not just an add.

**Recommended default: show-level rewatch log**, separate from episode-level progress entirely:

```sql
create table if not exists public.show_rewatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  show_id integer not null,
  show_name text not null,
  show_poster_path text,
  rewatched_at timestamptz not null default now(),
  note text
);
```
No unique constraint — it's an append-only log, unlike everything else in the schema.

**UI:**
- `ShowDetail.tsx` — once a show is "Finished" (existing `showActivity` logic already knows this), a "Log a rewatch" link using the same `DateMarkControl` pattern.
- `ShowDiary.tsx` and/or Profile stats — show rewatch count/dates.

**Effort: S–M** for the recommended version. Full per-episode tracking would be **L** and touches watch-progress logic used across Home, ShowDetail, and Activity — flagging that so it's an explicit choice, not a default.

---

## 4. Total watch-time

**Data model:** `episode_watched` doesn't store runtime today, only TMDB's episode-count snapshot. Two ways to get it:

- **Denormalize going forward (recommended, consistent with how this table already works):** add `runtime_minutes integer` to `episode_watched`, populated from the `TmdbEpisode.runtime` value `EpisodeRow.tsx` already has in hand when a mark-watched action fires. Threads through `markWatched` and `bulkMarkWatched` in `lib/watched.ts`.
- **Backfill:** existing rows will have `runtime_minutes = null`. A one-off script (not shipped in the app) re-fetching each distinct watched show/season from TMDB and updating existing rows would make historical stats accurate immediately instead of only going forward. Worth deciding whether that's worth doing now versus letting the stat build up from here.

**UI:** a 5th stat card on `Profile.tsx` ("Hours watched" = `sum(runtime_minutes) / 60`), possibly also on `PublicProfile.tsx`.

**Effort: S** for the feature itself; add a chunk of **S** for the backfill script if historical accuracy matters.

---

## 5. New-episode awareness

Two very different versions of this — worth being explicit about which one "notifications" means.

**In-app MVP (recommended first step, no new infra):** this session already added `isUpcoming` detection (future `air_date`) to `EpisodeRow.tsx` and `handleMarkSeasonWatched`. The natural extension:
- `ShowDetail.tsx` — a small banner for in-progress shows: "Next episode (S4E7) airs Aug 20," computed from the season data already fetched.
- `Home.tsx` — a "new episode Thu" badge on Now Watching cards. This needs next-air-date data per in-progress show, which `seasonProgress.ts`'s `fetchSeasonBreakdowns` doesn't currently expose (it has season-level summaries, not per-episode air dates) — would need one additional cached TMDB call per in-progress show's current season, following the same `seasonCache` pattern already there.

**Effort: S–M**, no schema changes.

**Real push/email notifications (flagging as a separate, much bigger thing):** this needs something to actively check TMDB on a schedule and reach the user outside the browser tab — a Supabase Edge Function on a cron trigger (or an external cron hitting an endpoint), plus a delivery channel: email (a provider like Resend/Postmark, a sending domain) or web push (VAPID keys, a service worker, a new table for push subscriptions). This would be the **first backend compute** this project has ever had — everything today is a static site plus direct Supabase/TMDB calls from the browser.

**Effort: L**, and it's infrastructure, not just a feature. Recommend shipping the in-app MVP first and only taking this on if the group actually wants notifications outside the app.

---

## 6. Custom lists

**Data model:** two tables, list + items:

```sql
create table if not exists public.show_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.show_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.show_lists(id) on delete cascade,
  show_id integer not null,
  show_name text not null,
  show_poster_path text,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  unique (list_id, show_id)
);
```

"Shareable" is close to free here — RLS is already permissive (anyone can read anything), so a list just needs a clean URL, not a separate sharing mechanism.

**UI:**
- New page + route: `/u/:username/lists/:listId`, following the exact pattern `ShowDiary.tsx` already uses for `/u/:username/shows/:showId` (fetch by username + id, reuse `ShowCard` for the grid).
- "My Lists" — likely a third Profile tab alongside Diary/History, with a create-list flow (name + optional description).
- An "Add to a list" picker on `ShowDetail.tsx` — existing lists plus "new list" inline.
- `Members.tsx`/`PublicProfile.tsx` could surface a person's public lists.

**Effort: M–L.** The largest net-new surface area on this list — two tables, a new page/route, a picker component, and list-management UI (create/rename/reorder/delete).

---

## 7. Yearly recap

Mostly a computed view over data that already exists (or will, once #4 and #3 ship) — filtered to a date range, no new tables strictly required for a first version.

**What's easy from existing tables:** shows finished this year, episodes watched this year, average rating this year, top-rated show, most active month — all derivable client-side from `show_ratings`/`episode_watched` the same way `showActivity.ts` already summarizes things.

**What depends on other items above:** total hours watched this year needs #4's `runtime_minutes`. A "rewatched the most" stat needs #3.

**What needs new data:** genre breakdown — genres aren't denormalized onto any watched/rating row today (only `show_name`/`poster_path` are), so this needs either a TMDB call per distinct show watched that year (cacheable) or denormalizing genres onto rows the same way runtime would be for #4.

**UI:** a new page or Profile tab, e.g. `/profile/recap` — stat cards, maybe a "share as image" stretch goal (skip for v1).

**Effort: M**, best sequenced *after* #4 and #3 so it has real data to summarize instead of a bunch of zeroes.

---

## Suggested build order

1. **Undo/confirmation on bulk actions** — smallest, no schema, highest safety value.
2. **Watchlist** — small, no dependencies, closes the most obvious Letterboxd-parity gap.
3. **Rewatches** (show-level version) — small, no dependencies, but needs the per-episode-vs-show-level decision made first.
4. **Total watch-time** — small feature, decide on backfill.
5. **New-episode awareness (in-app only)** — builds directly on this session's air-date work. Hold off on push/email notifications as a separate, later decision — it's infrastructure, not a feature.
6. **Custom lists** — biggest net-new surface, no dependencies, so it can move earlier or later depending on appetite.
7. **Yearly recap** — do last, since it's more useful once watch-time and rewatch data exist to summarize.
