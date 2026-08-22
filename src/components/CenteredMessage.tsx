import { Link } from 'react-router-dom'

/**
 * Centered message + back link -- the shared shape behind every
 * not-found/failed-to-load page in the app (missing member, missing list,
 * network failure, etc.), so each page doesn't reimplement the same block.
 */
export default function CenteredMessage({
  message,
  backTo = '/members',
  backLabel = 'Back to people',
}: {
  message: string
  backTo?: string
  backLabel?: string
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 text-center sm:px-6">
      <p className="text-sm text-base-500">{message}</p>
      <Link to={backTo} className="mt-3 inline-block text-sm text-accent-400 hover:underline">
        &larr; {backLabel}
      </Link>
    </div>
  )
}
