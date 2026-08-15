import { useEffect } from 'react'
import { motion } from 'framer-motion'

/**
 * A short-lived "Undo" affordance after a bulk mark-watched action, so a
 * mis-tap (or a change of mind) doesn't require manually re-fixing every
 * episode by hand. Auto-dismisses after `seconds` -- long enough to notice
 * and react, short enough not to just sit there forever.
 */
export default function UndoToast({
  message,
  onUndo,
  onDismiss,
  seconds = 8,
}: {
  message: string
  onUndo: () => void
  onDismiss: () => void
  seconds?: number
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, seconds * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6"
    >
      <div className="flex items-center gap-3 rounded-full border border-hairline-strong bg-base-850 px-4 py-2.5 shadow-2xl shadow-black/40">
        <p className="text-xs text-base-200">{message}</p>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 text-xs font-semibold text-accent-400 hover:underline"
        >
          Undo
        </button>
      </div>
    </motion.div>
  )
}
