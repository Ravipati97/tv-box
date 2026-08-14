# TV Box

Letterboxd, but for TV shows. Search a show, rate it episode by episode. Dark mode, mobile + desktop, built with React + Vite + Tailwind + Framer Motion, backed by Supabase (database) and TMDB (show data), hosted free on GitHub Pages.

Live at: `https://<your-github-username>.github.io/tv-box/` once deployed.

## How it works

GitHub Pages only serves static files — there's no server to run code and no database. So this app leans on two free backend services instead of a custom server:

- **Supabase** — just a Postgres database here (no email sending, no password auth — see "About sign-in" below). Stores registered users and everyone's episode ratings.
- **TMDB (The Movie Database)** — free API for show/season/episode data and artwork.

Both are called directly from the browser, so there's nothing to deploy except the static frontend.

### About sign-in

There's no password and no email verification. Signing in is just: type your email → if it's new, pick a username and you're registered; if it's already registered, you're straight in. That's it — no OTP, no magic link, no Supabase Auth.

This was a deliberate simplification: real email-based verification needs either Supabase's email sending (which, as of mid-2026, no longer lets free-tier projects customize the OTP email template) or your own SMTP provider — both are more setup than this project needs. The tradeoff is that anyone who knows or guesses another user's email could sign in as them — fine for a personal/hobby project, not something to put real accounts behind. If you want real security later, swap `AuthContext.tsx` for Supabase Auth (email OTP or password) and tighten the RLS policies in `schema.sql` to check `auth.uid()` instead of allowing all requests.

## One-time setup

You need to do these four things before the app works. Takes about 5 minutes.

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (GitHub login is easiest).
2. You land on the **Organization** page. Click **New project**.
3. Pick a name (e.g. `tv-box`), generate/set a database password (save it somewhere, just in case), pick the region closest to you, leave the plan as **Free**.
4. Click **Create new project**. It takes 1–2 minutes to provision.
5. Copy your API credentials: left sidebar → gear icon **Project Settings** → **API Keys** (or **Data API** in some versions). Copy the **Project URL** — that's `VITE_SUPABASE_URL`. For the key, either grab the **Publishable key** (`sb_publishable_...`) if you see one, or the **anon** `public` key (starts `eyJ...`) under a **Legacy API Keys** tab if that's what's shown — either works the same as `VITE_SUPABASE_ANON_KEY`.
6. Run the schema: left sidebar → **SQL Editor** → **New query**. Open [`supabase/schema.sql`](./supabase/schema.sql) from this repo, paste its full contents in, and click **Run**. You should see "Success. No rows returned." This creates the `users` and `episode_ratings` tables.

That's the whole Supabase side — no auth providers, no email templates to configure.

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

- Lightweight sign-in: enter an email — new users pick a username, returning users are straight in. No password, no verification (see "About sign-in" above).
- Search any TV show (TMDB).
- Per-episode 5-star rating (half-star precision) — click the same rating again to clear it.
- Crowd ratings: every episode also shows the average from everyone else who's rated it, with an expandable "who rated what" list.
- Members directory (`/members`) — everyone who's registered, searchable by username.
- Public profiles (`/u/username`) — anyone's diary + stats, read-only.
- Your own profile page: a diary of everything you've rated, with quick stats (episodes rated, shows, average rating).
- Fully responsive: bottom tab bar on mobile, top nav on desktop. Dark mode only.

Not included by design (per the original scope): recommendations, trending, reviews/comments, watchlists, and any notion of "following" (everyone can already see everyone — see "About sign-in"). All straightforward to add later on top of the same tables.

## Project structure

```
src/
  components/     StarRating, ShowCard, EpisodeRow, Navbar, SeasonTabs, skeleton loaders
  contexts/       AuthContext (email + username sign-in, session kept in localStorage)
  lib/            supabase.ts, tmdb.ts, ratings.ts, users.ts (all Supabase/TMDB calls live here)
  pages/          Login, Search, ShowDetail, Profile, Members, PublicProfile
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
