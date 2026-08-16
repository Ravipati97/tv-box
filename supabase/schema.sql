-- TV Box: schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
--
-- There is no real authentication in this app (no password, no email
-- verification) -- signing in is just "type your email, pick a username".
-- Because of that there's no secure session to key Row Level Security off
-- of, so these tables use permissive policies (any request with the anon
-- key can read/write). That's an intentional tradeoff for a low-stakes
-- personal project. If you ever want real per-user privacy, swap this for
-- Supabase Auth (email OTP or password) and switch these policies to check
-- auth.uid() instead.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "Anyone can read users" on public.users;
create policy "Anyone can read users"
  on public.users for select
  using (true);

drop policy if exists "Anyone can register a user" on public.users;
create policy "Anyone can register a user"
  on public.users for insert
  with check (true);

create table if not exists public.episode_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  -- Denormalized TMDB show/episode info so the profile diary never has to
  -- re-fetch TMDB, and history survives even if a show is removed from TMDB.
  show_id integer not null,
  show_name text not null,
  show_poster_path text,
  season_number integer not null,
  episode_number integer not null,
  episode_name text,

  rating numeric(2,1) not null check (rating >= 0.5 and rating <= 5),
  rated_at timestamptz not null default now(),

  unique (user_id, show_id, season_number, episode_number)
);

create index if not exists episode_ratings_user_id_idx on public.episode_ratings (user_id);
create index if not exists episode_ratings_user_show_idx on public.episode_ratings (user_id, show_id);
create index if not exists episode_ratings_rated_at_idx on public.episode_ratings (user_id, rated_at desc);

alter table public.episode_ratings enable row level security;

drop policy if exists "Anyone can read ratings" on public.episode_ratings;
create policy "Anyone can read ratings"
  on public.episode_ratings for select
  using (true);

drop policy if exists "Anyone can insert ratings" on public.episode_ratings;
create policy "Anyone can insert ratings"
  on public.episode_ratings for insert
  with check (true);

drop policy if exists "Anyone can update ratings" on public.episode_ratings;
create policy "Anyone can update ratings"
  on public.episode_ratings for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete ratings" on public.episode_ratings;
create policy "Anyone can delete ratings"
  on public.episode_ratings for delete
  using (true);

-- Reactions on episode ratings were removed (episode-level rating/social was
-- too granular in practice -- see show_ratings below). Drops cleanly since
-- nothing reads or writes it anymore.
drop table if exists public.rating_reactions cascade;

-- Episode-level ratings are no longer collected (superseded by show_ratings
-- below) -- this table is intentionally left in place, untouched, so nobody
-- loses their existing episode-rating history. The app no longer reads or
-- writes it.

-- One rating per person per show (5-star scale, half-star precision). This
-- replaced episode-level rating: rating every episode individually turned
-- out to be more friction than it was worth for most people.
create table if not exists public.show_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  show_id integer not null,
  show_name text not null,
  show_poster_path text,

  rating numeric(2,1) not null check (rating >= 0.5 and rating <= 5),
  rated_at timestamptz not null default now(),

  unique (user_id, show_id)
);

create index if not exists show_ratings_user_id_idx on public.show_ratings (user_id);
create index if not exists show_ratings_rated_at_idx on public.show_ratings (user_id, rated_at desc);

alter table public.show_ratings enable row level security;

drop policy if exists "Anyone can read show ratings" on public.show_ratings;
create policy "Anyone can read show ratings"
  on public.show_ratings for select
  using (true);

drop policy if exists "Anyone can insert show ratings" on public.show_ratings;
create policy "Anyone can insert show ratings"
  on public.show_ratings for insert
  with check (true);

drop policy if exists "Anyone can update show ratings" on public.show_ratings;
create policy "Anyone can update show ratings"
  on public.show_ratings for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete show ratings" on public.show_ratings;
create policy "Anyone can delete show ratings"
  on public.show_ratings for delete
  using (true);

-- One rating per person per *season*, independent of show_ratings above --
-- lets "the show's a 4 overall but season 2 was rough" be expressed, the
-- way IMDb/Rotten Tomatoes surface season-level scores alongside a show's
-- overall one. Deliberately not averaged into or derived from show_ratings
-- (or vice versa) -- both are separate, manually-set opinions.
create table if not exists public.season_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  show_id integer not null,
  show_name text not null,
  show_poster_path text,
  season_number integer not null,
  season_name text,

  rating numeric(2,1) not null check (rating >= 0.5 and rating <= 5),
  rated_at timestamptz not null default now(),

  unique (user_id, show_id, season_number)
);

create index if not exists season_ratings_user_id_idx on public.season_ratings (user_id);
create index if not exists season_ratings_user_show_idx on public.season_ratings (user_id, show_id);

alter table public.season_ratings enable row level security;

drop policy if exists "Anyone can read season ratings" on public.season_ratings;
create policy "Anyone can read season ratings"
  on public.season_ratings for select
  using (true);

drop policy if exists "Anyone can insert season ratings" on public.season_ratings;
create policy "Anyone can insert season ratings"
  on public.season_ratings for insert
  with check (true);

drop policy if exists "Anyone can update season ratings" on public.season_ratings;
create policy "Anyone can update season ratings"
  on public.season_ratings for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete season ratings" on public.season_ratings;
create policy "Anyone can delete season ratings"
  on public.season_ratings for delete
  using (true);

-- One row per episode a person has marked watched -- powers per-show "12/24
-- watched" progress and (soon) a Now Watching home view. show_total_episodes
-- is a denormalized snapshot of TMDB's episode count at the time of the most
-- recent watch, so progress badges elsewhere don't need an extra TMDB call.
create table if not exists public.episode_watched (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  show_id integer not null,
  show_name text not null,
  show_poster_path text,
  show_total_episodes integer,
  season_number integer not null,
  episode_number integer not null,
  episode_name text,

  watched_at timestamptz not null default now(),

  unique (user_id, show_id, season_number, episode_number)
);

-- Added after episode_watched already existed in production, so this is an
-- ALTER (CREATE TABLE IF NOT EXISTS above is a no-op on an existing table
-- and would silently skip new columns). True when the person logging this
-- didn't remember the actual date -- watched_at still holds a placeholder
-- timestamp (so the column can stay NOT NULL), but the UI shows "watched a
-- while ago" instead of that placeholder whenever this is true.
alter table public.episode_watched
  add column if not exists watched_at_unknown boolean not null default false;

create index if not exists episode_watched_user_id_idx on public.episode_watched (user_id);
create index if not exists episode_watched_user_show_idx on public.episode_watched (user_id, show_id);
create index if not exists episode_watched_watched_at_idx on public.episode_watched (user_id, watched_at desc);

alter table public.episode_watched enable row level security;

drop policy if exists "Anyone can read watched episodes" on public.episode_watched;
create policy "Anyone can read watched episodes"
  on public.episode_watched for select
  using (true);

drop policy if exists "Anyone can insert watched episodes" on public.episode_watched;
create policy "Anyone can insert watched episodes"
  on public.episode_watched for insert
  with check (true);

drop policy if exists "Anyone can update watched episodes" on public.episode_watched;
create policy "Anyone can update watched episodes"
  on public.episode_watched for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete watched episodes" on public.episode_watched;
create policy "Anyone can delete watched episodes"
  on public.episode_watched for delete
  using (true);

-- Manual correction for "where to watch", shared across the whole group (not
-- per-user) -- streaming availability is an objective regional fact, not a
-- matter of taste, so one correction should fix it for everyone rather than
-- each person having to notice and fix it themselves. One row per show;
-- setting a new override just replaces the old one (last editor wins, same
-- spirit as everything else in this no-real-auth app).
create table if not exists public.show_streaming_overrides (
  id uuid primary key default gen_random_uuid(),
  show_id integer not null unique,

  provider_id integer,
  provider_name text not null,
  provider_logo_path text,

  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.show_streaming_overrides enable row level security;

drop policy if exists "Anyone can read streaming overrides" on public.show_streaming_overrides;
create policy "Anyone can read streaming overrides"
  on public.show_streaming_overrides for select
  using (true);

drop policy if exists "Anyone can insert streaming overrides" on public.show_streaming_overrides;
create policy "Anyone can insert streaming overrides"
  on public.show_streaming_overrides for insert
  with check (true);

drop policy if exists "Anyone can update streaming overrides" on public.show_streaming_overrides;
create policy "Anyone can update streaming overrides"
  on public.show_streaming_overrides for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete streaming overrides" on public.show_streaming_overrides;
create policy "Anyone can delete streaming overrides"
  on public.show_streaming_overrides for delete
  using (true);

-- "Want to watch" -- shows saved before starting, independent of
-- episode_watched (which only tracks progress on shows you've actually
-- started). No update policy: you either have a show on your watchlist or
-- you don't, there's nothing on a row to edit.
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  show_id integer not null,
  show_name text not null,
  show_poster_path text,

  added_at timestamptz not null default now(),

  unique (user_id, show_id)
);

create index if not exists watchlist_user_id_idx on public.watchlist (user_id);
create index if not exists watchlist_added_at_idx on public.watchlist (user_id, added_at desc);

alter table public.watchlist enable row level security;

drop policy if exists "Anyone can read watchlist" on public.watchlist;
create policy "Anyone can read watchlist"
  on public.watchlist for select
  using (true);

drop policy if exists "Anyone can insert watchlist" on public.watchlist;
create policy "Anyone can insert watchlist"
  on public.watchlist for insert
  with check (true);

drop policy if exists "Anyone can delete watchlist" on public.watchlist;
create policy "Anyone can delete watchlist"
  on public.watchlist for delete
  using (true);

-- A simple, append-only log of "I rewatched this show" events -- separate
-- from episode_watched (which tracks first-watch progress: "N/M watched",
-- Now Watching, Finished) so logging a rewatch never touches or
-- reinterprets that progress math. Unlike every other per-user-per-show
-- table here, there's deliberately no unique constraint -- you can log this
-- as many times as you actually rewatch the show.
create table if not exists public.show_rewatches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  show_id integer not null,
  show_name text not null,
  show_poster_path text,

  rewatched_at timestamptz not null default now()
);

create index if not exists show_rewatches_user_id_idx on public.show_rewatches (user_id);
create index if not exists show_rewatches_user_show_idx on public.show_rewatches (user_id, show_id);

alter table public.show_rewatches enable row level security;

drop policy if exists "Anyone can read rewatches" on public.show_rewatches;
create policy "Anyone can read rewatches"
  on public.show_rewatches for select
  using (true);

drop policy if exists "Anyone can insert rewatches" on public.show_rewatches;
create policy "Anyone can insert rewatches"
  on public.show_rewatches for insert
  with check (true);

drop policy if exists "Anyone can delete rewatches" on public.show_rewatches;
create policy "Anyone can delete rewatches"
  on public.show_rewatches for delete
  using (true);

-- Total watch-time: runtime (minutes) as of when each episode was marked
-- watched, denormalized from TMDB the same way show_total_episodes already
-- is, so "hours watched" never needs a fresh TMDB call to compute. Rows
-- logged before this column existed have runtime_minutes = null (they
-- contribute 0 until backfilled -- see scripts/backfill-runtime.mjs).
alter table public.episode_watched
  add column if not exists runtime_minutes integer;

-- User-curated lists of shows (e.g. "Comfort shows"). "Shareable" is close
-- to free here since every table in this app is already fully readable by
-- anyone (no real per-user privacy) -- a list just needs a clean URL, not a
-- separate sharing mechanism.
create table if not exists public.show_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  name text not null,
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists show_lists_user_id_idx on public.show_lists (user_id);

alter table public.show_lists enable row level security;

drop policy if exists "Anyone can read lists" on public.show_lists;
create policy "Anyone can read lists"
  on public.show_lists for select
  using (true);

drop policy if exists "Anyone can insert lists" on public.show_lists;
create policy "Anyone can insert lists"
  on public.show_lists for insert
  with check (true);

drop policy if exists "Anyone can update lists" on public.show_lists;
create policy "Anyone can update lists"
  on public.show_lists for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete lists" on public.show_lists;
create policy "Anyone can delete lists"
  on public.show_lists for delete
  using (true);

-- Explicit "in progress" marker for a show you've declared you're starting
-- but haven't logged any episodes for yet. Now Watching used to be purely
-- derived from episode_watched (no status field to keep in sync), so "Start
-- watching" faked it by marking episode 1 watched -- which polluted real
-- watch history with an episode you hadn't actually seen. This table exists
-- only to cover that 0/x gap: once episode_watched has real rows for the
-- show, those drive watchedCount/progress as normal, and this row just sits
-- alongside them harmlessly (see summarizeShowActivity in showActivity.ts).
create table if not exists public.show_started (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  show_id integer not null,
  show_name text not null,
  show_poster_path text,
  show_total_episodes integer,

  started_at timestamptz not null default now(),

  unique (user_id, show_id)
);

create index if not exists show_started_user_id_idx on public.show_started (user_id);

alter table public.show_started enable row level security;

drop policy if exists "Anyone can read started shows" on public.show_started;
create policy "Anyone can read started shows"
  on public.show_started for select
  using (true);

drop policy if exists "Anyone can insert started shows" on public.show_started;
create policy "Anyone can insert started shows"
  on public.show_started for insert
  with check (true);

drop policy if exists "Anyone can delete started shows" on public.show_started;
create policy "Anyone can delete started shows"
  on public.show_started for delete
  using (true);

-- Explicit "hide this from Now Watching" marker -- lets someone clear a show
-- off the Home page without touching anything real (episode_watched rows,
-- ratings, and show_started all stay exactly as they were). Deliberately not
-- a delete of show_started/episode_watched: those are watch history and
-- progress, this is just "don't show this on Home right now". The app
-- clears this automatically the next time an episode is marked watched or
-- "Start watching" is tapped again for the show (see ShowDetail.tsx), so
-- picking a dismissed show back up naturally un-hides it -- this is meant as
-- "get this off my list for now", not a permanent block.
create table if not exists public.show_watching_dismissed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  show_id integer not null,

  dismissed_at timestamptz not null default now(),

  unique (user_id, show_id)
);

create index if not exists show_watching_dismissed_user_id_idx on public.show_watching_dismissed (user_id);

alter table public.show_watching_dismissed enable row level security;

drop policy if exists "Anyone can read dismissed now-watching" on public.show_watching_dismissed;
create policy "Anyone can read dismissed now-watching"
  on public.show_watching_dismissed for select
  using (true);

drop policy if exists "Anyone can insert dismissed now-watching" on public.show_watching_dismissed;
create policy "Anyone can insert dismissed now-watching"
  on public.show_watching_dismissed for insert
  with check (true);

drop policy if exists "Anyone can delete dismissed now-watching" on public.show_watching_dismissed;
create policy "Anyone can delete dismissed now-watching"
  on public.show_watching_dismissed for delete
  using (true);

create table if not exists public.show_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.show_lists(id) on delete cascade,

  show_id integer not null,
  show_name text not null,
  show_poster_path text,

  added_at timestamptz not null default now(),

  unique (list_id, show_id)
);

create index if not exists show_list_items_list_id_idx on public.show_list_items (list_id);

alter table public.show_list_items enable row level security;

drop policy if exists "Anyone can read list items" on public.show_list_items;
create policy "Anyone can read list items"
  on public.show_list_items for select
  using (true);

drop policy if exists "Anyone can insert list items" on public.show_list_items;
create policy "Anyone can insert list items"
  on public.show_list_items for insert
  with check (true);

drop policy if exists "Anyone can delete list items" on public.show_list_items;
create policy "Anyone can delete list items"
  on public.show_list_items for delete
  using (true);
