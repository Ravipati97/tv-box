# TV Box

Letterboxd, but for TV shows. Search a show, rate it episode by episode. Dark mode, mobile + desktop, built with React + Vite + Tailwind + Framer Motion, backed by Supabase (auth + database) and TMDB (show data), hosted free on GitHub Pages.

Live at: `https://<your-github-username>.github.io/tv-box/` once deployed.

## How it works

GitHub Pages only serves static files — there's no server to run code, no database, and no way to send emails. So this app leans on two free backend services instead of a custom server:

- **Supabase** — Postgres database + built-in passwordless email-OTP auth. This is what sends the 6-digit login code to a user's Gmail (or any email) and stores everyone's episode ratings.
- **TMDB (The Movie Database)** — free API for show/season/episode data and artwork.

Both are called directly from the browser, so there's nothing to deploy except the static frontend.

## One-time setup

You need to do these four things before the app works. Takes about 10 minutes.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, click **New project**.
2. Once it's created, go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key — you'll need both shortly.
3. Go to **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the `episode_ratings` table with row-level security so each user can only ever see their own ratings.
4. Go to **Authentication → Providers → Email** and make sure Email is enabled. Turn **off** "Confirm email" if you want first-time sign-in to work with just the code (otherwise it still works, it just also requires the code — Supabase's OTP flow handles this fine either way).
5. Go to **Authentication → Emails → Magic Link** template (this is the template `signInWithOtp` uses). By default it only shows a clickable link. Edit it so the 6-digit code is visible, e.g.:

   ```html
   <h2>Your TV Box login code</h2>
   <p>Enter this code in the app:</p>
   <h1>{{ .Token }}</h1>
   <p>This code expires shortly and can only be used once.</p>
   ```

   The `{{ .Token }}` variable is the numeric code the app's login screen asks for.

### 2. Get a TMDB API key

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/signup).
2. Go to **Settings → API**, request a key (choose "Developer", any description works), and copy the **API Key (v3 auth)**.

### 3. Configure local development

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with the three values from steps 1 and 2:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_TMDB_API_KEY=...
```

```bash
npm run dev
```

`.env.local` is gitignored and never committed.

### 4. Configure GitHub Pages deployment

The repo already has a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys automatically on every push to `main`. It needs the same three values as repository secrets:

1. On GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Add all three: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TMDB_API_KEY`.
3. Go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Push to `main` — the workflow builds and deploys automatically. Check the **Actions** tab for progress. The site goes live at `https://<username>.github.io/tv-box/`.

If you ever rename the repository, update `base: '/tv-box/'` in `vite.config.ts` to match.

## Features (v1)

- Passwordless login: enter an email, get a 6-digit code, sign in.
- Search any TV show (TMDB).
- Per-episode 5-star rating (half-star precision) — click the same rating again to clear it.
- Profile page: a diary of everything you've rated, with quick stats (episodes rated, shows, average rating).
- Fully responsive: bottom tab bar on mobile, top nav on desktop. Dark mode only.

Not included by design (per the original scope): recommendations, trending, social/follow features, reviews/comments, watchlists. All straightforward to add later on top of the same `episode_ratings` table / Supabase project.

## Project structure

```
src/
  components/     StarRating, ShowCard, EpisodeRow, Navbar, SeasonTabs, skeleton loaders
  contexts/       AuthContext (Supabase session + OTP login)
  lib/            supabase.ts, tmdb.ts, ratings.ts (all Supabase/TMDB calls live here)
  pages/          Login, Search, ShowDetail, Profile
supabase/
  schema.sql      Run once in the Supabase SQL editor
.github/workflows/
  deploy.yml      Builds + deploys to GitHub Pages on push to main
```

Routing uses `HashRouter` (URLs look like `/#/show/123`) since GitHub Pages can't do server-side rewrites for a client-side router — this avoids needing a 404.html redirect hack and just works.

## Local scripts

```bash
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build locally
npm run lint     # oxlint
```
