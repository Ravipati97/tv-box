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

**a. Create the project**
1. Go to [supabase.com](https://supabase.com) and sign in (GitHub login is easiest).
2. You land on the **Organization** page. Click **New project**.
3. Pick a name (e.g. `tv-box`), generate/set a database password (save it somewhere — you likely won't need it again, but just in case), pick the region closest to you, leave the plan as **Free**.
4. Click **Create new project**. It takes 1–2 minutes to provision — you'll see a progress screen, then land on the project dashboard.

**b. Copy your API credentials**
1. In the left sidebar, click the gear icon **Project Settings** (near the bottom), then **API Keys** (or **Data API** in some versions).
2. Copy the **Project URL** at the top — this is `VITE_SUPABASE_URL`.
3. For the key, Supabase has two naming schemes depending on when your project was created:
   - If you see a **Publishable key** (starts with `sb_publishable_...`), copy that — it's `VITE_SUPABASE_ANON_KEY`.
   - If instead you see a **Legacy API Keys** tab with an `anon` `public` key (a long string starting with `eyJ...`), copy that one instead. Either format works fine — they do the same job.

**c. Run the database schema**
1. In the left sidebar, click **SQL Editor**, then **New query**.
2. Open [`supabase/schema.sql`](./supabase/schema.sql) from this repo, copy its full contents, and paste them into the query editor.
3. Click **Run** (or press Cmd/Ctrl+Enter). You should see "Success. No rows returned." This creates the `episode_ratings` table plus the security rules that keep each user's ratings private to them.

**d. Turn on email login**
1. Left sidebar → **Authentication** → **Sign In / Providers** (or **Providers** tab).
2. Confirm **Email** is enabled (it is by default on new projects).

**e. Make the login code show up in the email**
1. Left sidebar → **Authentication** → **Emails** → **Templates**, then select the **Magic Link** template (this is the one used behind the scenes when the app asks for an OTP).
2. By default the template only shows a clickable link, not a code. Replace the template body with something like:

   ```html
   <h2>Your TV Box login code</h2>
   <p>Enter this code in the app:</p>
   <h1>{{ .Token }}</h1>
   <p>This code expires shortly and can only be used once.</p>
   ```

   `{{ .Token }}` is the 6-digit code — that's the actual line that matters. Save the template.

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
