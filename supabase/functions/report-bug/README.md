# report-bug Edge Function

Files a GitHub issue on `thetvbox/thetvbox.github.io` from the app's "Report
a bug" form, using a token that stays server-side. One-time setup, then it
just works.

**No Supabase CLI needed.** Everything below is done through the Supabase
Dashboard in the browser — Supabase added a full in-dashboard function
editor + deploy button, so there's nothing to install locally. (A CLI-based
path is included at the bottom, in case you ever do set the CLI up.)

## 1. Create a GitHub token

1. GitHub → Settings → Developer settings → **Fine-grained personal access
   tokens** → Generate new token.
2. **Repository access**: Only select repositories → `thetvbox.github.io`.
3. **Permissions** → Repository permissions → **Issues**: Read and write.
   (Everything else can stay "No access.")
4. Generate, and copy the token (`github_pat_...`) somewhere safe — GitHub
   only shows it once.

## 2. Add it as a Supabase secret

1. Open your project's secrets page:
   [supabase.com/dashboard/project/fuitioxkdagmfnvpteys/functions/secrets](https://supabase.com/dashboard/project/fuitioxkdagmfnvpteys/functions/secrets)
2. Add a secret named `GITHUB_TOKEN`, paste the token from step 1 as the
   value, and press **Save**.

That's live immediately — no redeploy needed for a secret change.

## 3. Deploy the function via the Dashboard editor

1. In your project, go to **Edge Functions** in the left sidebar:
   [supabase.com/dashboard/project/fuitioxkdagmfnvpteys/functions](https://supabase.com/dashboard/project/fuitioxkdagmfnvpteys/functions)
2. Click **"Deploy a new function"** → **"Via Editor"**.
3. When it asks for a template, ignore them (or pick "Hello World" as a
   starting point to overwrite) — this doesn't match any pre-built template.
4. Name the function **exactly** `report-bug` (the app calls it by this
   name, via `supabase.functions.invoke('report-bug', ...)` — a typo here
   means the app can't find it).
5. Delete whatever code is in the editor, and paste in the full contents of
   this repo's `supabase/functions/report-bug/index.ts`.
6. Click **"Deploy function"** at the bottom. Takes 10–30 seconds.

You should see a success message, and the function will be live at
`https://fuitioxkdagmfnvpteys.supabase.co/functions/v1/report-bug`.

### If you ever need to update this function's code later

The Dashboard editor has **no version control** — it just overwrites
whatever's deployed. If this file (`index.ts`) changes in a future update to
the app, you'll need to manually copy the new version into the Dashboard
editor again: open the `report-bug` function → edit the code → **"Deploy
updates"**.

## That's it

No other config needed — the app calls this via
`supabase.functions.invoke('report-bug', ...)`, which already sends the
publishable/anon key the app already uses everywhere else, so there's no
separate auth setup. If `GITHUB_TOKEN` isn't set yet, the function returns a
clear "not configured" error instead of a confusing failure, so the in-app
form can tell you what's missing.

## Optional: CLI path, if you set up the Supabase CLI later

```sh
supabase login
supabase link --project-ref fuitioxkdagmfnvpteys
supabase secrets set GITHUB_TOKEN=github_pat_...
supabase functions deploy report-bug
```

This has an advantage the Dashboard editor doesn't: `index.ts` in this repo
stays the actual source of truth, and `deploy` just pushes whatever's
committed — no manual copy-pasting, no drift between what's in git and
what's live.
