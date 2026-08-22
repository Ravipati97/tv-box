import changelogRaw from '../../CHANGELOG.md?raw'

export type ChangelogBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }

export interface ChangelogRelease {
  version: string
  date: string | null
  blocks: ChangelogBlock[]
}

/**
 * Hand-rolled, not a markdown library -- CHANGELOG.md only ever uses a small,
 * fixed subset of markdown (## release headings, ### subheadings, "- " list
 * items, plain paragraphs, and trailing "[x.y.z]: url" reference links to
 * skip), since this app is the only thing that ever writes to that file. A
 * real parser would be overkill for a format this constrained.
 */
export function parseChangelog(raw: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  let current: ChangelogRelease | null = null

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trimEnd()

    const releaseMatch = line.match(/^## \[(.+?)\](?: - (.+))?/)
    if (releaseMatch) {
      current = { version: releaseMatch[1], date: releaseMatch[2] ?? null, blocks: [] }
      // "Unreleased" starts out empty -- only surface it once it has content.
      releases.push(current)
      continue
    }
    if (!current) continue // Skip the H1 title + intro paragraph before the first release.

    if (line.startsWith('### ')) {
      current.blocks.push({ type: 'heading', text: line.slice(4).trim() })
      continue
    }
    if (line.startsWith('- ')) {
      const last = current.blocks[current.blocks.length - 1]
      if (last?.type === 'list') last.items.push(line.slice(2).trim())
      else current.blocks.push({ type: 'list', items: [line.slice(2).trim()] })
      continue
    }
    if (/^\[.+\]:\s*https?:\/\//.test(line)) continue // Reference-link definitions at the bottom.
    if (line.trim() === '') continue

    const last = current.blocks[current.blocks.length - 1]
    if (last?.type === 'paragraph') last.text += ' ' + line.trim()
    else current.blocks.push({ type: 'paragraph', text: line.trim() })
  }

  return releases.filter((r) => r.blocks.length > 0)
}

export const changelogReleases: ChangelogRelease[] = parseChangelog(changelogRaw)

/** Inlined at build time from package.json (see vite.config.ts) -- the
 * single source of truth for both the npm package version and what Profile
 * shows as the running app's version. */
export const appVersion = __APP_VERSION__
