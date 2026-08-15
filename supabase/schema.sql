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
