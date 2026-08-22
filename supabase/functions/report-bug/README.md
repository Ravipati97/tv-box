# report-bug Edge Function

Files a GitHub issue on `thetvbox/thetvbox.github.io` from the app's "Report
a bug" form, using a token that stays server-side. One-time setup, then it
just works.

## 1. Create a GitHub token

1. GitHub → Settings → Developer settings → **Fine-grained personal access
   tokens** → Generate new token.
2. **Repository access**: Only select repositories → `thetvbox.github.io`.
3. **Permissions** → Repository permissions → **Issues**: Read and write.
   (Everything else can stay "No access.")
4. Generate, and copy the token (`github_pat_...`) somewhere safe — GitHub
   only shows it once.

## 2. Add it as a Supabase secret

Easiest via the dashboard: your Supabase project → **Edge Functions** →
**Secrets** → add a secret named `GITHUB_TOKEN` with the token as its value.

Or via the CLI, if you'd rather:

```sh
supabase secrets set GITHUB_TOKEN=github_pat_...
```

## 3. Deploy the function

From the repo root, first time only:

```sh
supabase login
supabase link --project-ref <your-project-ref>   # find this in your Supabase project's URL/settings
```

Then, now and any time this function's code changes:

```sh
supabase functions deploy report-bug
```

## That's it

No other config needed — the app calls this via
`supabase.functions.invoke('report-bug', ...)`, which already sends the
publishable/anon key the app already uses everywhere else, so there's no
separate auth setup. If `GITHUB_TOKEN` isn't set yet, the function returns a
clear "not configured" error instead of a confusing failure, so the in-app
form can tell you what's missing.
