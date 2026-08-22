// Supabase Edge Function: takes a bug report from the app and silently
// files it as a GitHub issue on thetvbox/thetvbox.github.io, using a PAT
// that never reaches the client. See supabase/functions/report-bug/README.md
// for the one-time setup (token + secret + deploy) this needs to actually run.
//
// Invoked from the client via supabase.functions.invoke('report-bug', ...),
// which automatically sends the publishable/anon key as the Authorization
// bearer token -- this app has no real Supabase Auth sessions (see
// src/contexts/AuthContext.tsx, a plain table-backed login), so there's no
// user JWT to check here. Anyone with the anon key (already public, baked
// into the client bundle like the rest of this app's "soft deterrent"
// security model -- see .env.example) can call this. That's an accepted
// trade-off for a small friend-group app; the length caps below are just to
// stop an accidental flood, not real abuse protection.

const GITHUB_OWNER = 'thetvbox'
const GITHUB_REPO = 'thetvbox.github.io'
const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 4000

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReportBugPayload {
  title: string
  description: string
  username?: string
  page?: string
  appVersion?: string
  userAgent?: string
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let payload: ReportBugPayload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  // req.json() succeeds for any valid JSON value, not just objects (e.g.
  // "null", "42", "[]") -- without this, payload.title below would throw on
  // a null body and surface as an opaque 500 instead of this 400.
  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  // The app's own form always sends strings, but this endpoint is reachable
  // by anyone with the (intentionally public, see comment above) anon key --
  // a hand-crafted request with e.g. title: 123 would otherwise throw on
  // .trim() and surface as an opaque 500 instead of this 400.
  if (typeof payload.title !== 'string' || typeof payload.description !== 'string') {
    return jsonResponse({ error: 'title and description are required' }, 400)
  }

  const title = payload.title.trim().slice(0, MAX_TITLE_LENGTH)
  const description = payload.description.trim().slice(0, MAX_DESCRIPTION_LENGTH)
  if (!title || !description) {
    return jsonResponse({ error: 'title and description are required' }, 400)
  }

  const token = Deno.env.get('GITHUB_TOKEN')
  if (!token) {
    // Not configured yet -- see the README next to this file. Distinct from
    // a GitHub API failure so the client can show a clearer message.
    return jsonResponse({ error: 'Bug reporting isn’t configured on the server yet.' }, 501)
  }

  const metadata = [
    payload.username ? `Reported by: @${payload.username}` : null,
    payload.page ? `Page: ${payload.page}` : null,
    payload.appVersion ? `App version: v${payload.appVersion}` : null,
    payload.userAgent ? `User agent: ${payload.userAgent}` : null,
  ].filter(Boolean)

  const body = [
    description,
    metadata.length > 0 ? '\n---\n' + metadata.join('\n') : null,
    '\n_Filed automatically from the TV Box app’s in-app bug report form._',
  ]
    .filter(Boolean)
    .join('\n')

  const ghResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'tv-box-report-bug-function',
      },
      body: JSON.stringify({ title, body, labels: ['bug', 'from-app'] }),
    },
  )

  if (!ghResponse.ok) {
    // Swallow GitHub's raw response -- it can include request details we'd
    // rather not hand back to an unauthenticated caller. Logged instead,
    // visible in the function's own logs in the Supabase dashboard.
    console.error('GitHub issue creation failed', ghResponse.status, await ghResponse.text())
    return jsonResponse({ error: 'Failed to file the issue on GitHub. Try again later.' }, 502)
  }

  const issue = await ghResponse.json()
  return jsonResponse({ url: issue.html_url, number: issue.number }, 200)
})
