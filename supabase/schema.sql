-- TV Box: episode ratings schema
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).

create table if not exists public.episode_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

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

-- Row Level Security: every user can only ever see/write their own ratings.
alter table public.episode_ratings enable row level security;

drop policy if exists "Users can view their own ratings" on public.episode_ratings;
create policy "Users can view their own ratings"
  on public.episode_ratings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own ratings" on public.episode_ratings;
create policy "Users can insert their own ratings"
  on public.episode_ratings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ratings" on public.episode_ratings;
create policy "Users can update their own ratings"
  on public.episode_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own ratings" on public.episode_ratings;
create policy "Users can delete their own ratings"
  on public.episode_ratings for delete
  using (auth.uid() = user_id);
