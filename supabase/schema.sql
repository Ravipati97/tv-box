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

-- One quick emoji reaction per person per rating (e.g. react to a friend's
-- 5-star Severance rating with 🔥). Re-reacting with the same emoji removes
-- it; reacting with a different emoji swaps it -- enforced in the app, not
-- the database, so the unique constraint just caps it at one row per pair.
create table if not exists public.rating_reactions (
  id uuid primary key default gen_random_uuid(),
  rating_id uuid not null references public.episode_ratings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),

  unique (rating_id, user_id)
);

create index if not exists rating_reactions_rating_id_idx on public.rating_reactions (rating_id);

alter table public.rating_reactions enable row level security;

drop policy if exists "Anyone can read reactions" on public.rating_reactions;
create policy "Anyone can read reactions"
  on public.rating_reactions for select
  using (true);

drop policy if exists "Anyone can insert reactions" on public.rating_reactions;
create policy "Anyone can insert reactions"
  on public.rating_reactions for insert
  with check (true);

drop policy if exists "Anyone can update reactions" on public.rating_reactions;
create policy "Anyone can update reactions"
  on public.rating_reactions for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete reactions" on public.rating_reactions;
create policy "Anyone can delete reactions"
  on public.rating_reactions for delete
  using (true);
