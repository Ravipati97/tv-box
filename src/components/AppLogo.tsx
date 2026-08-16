import { useId } from 'react'

/**
 * The TV Box mark -- shared by the navbar, login screen, and passcode gate
 * (previously copy-pasted identically into all three). useId (not a fixed
 * gradient id) keeps multiple instances from clashing if two ever render
 * on the same page at once.
 */
export default function AppLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  const gradientId = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-accent-400)" />
          <stop offset="1" stopColor="var(--color-accent-600)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <rect x="6" y="9" width="20" height="14" rx="3" fill="var(--color-base-950)" />
      <path d="M15 14.5L19 16.5L15 18.5V14.5Z" fill="var(--color-star)" />
    </svg>
  )
}
