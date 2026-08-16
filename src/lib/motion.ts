/** Whether the OS-level "reduce motion" accessibility setting is on.
 * MotionConfig (see App.tsx) already covers every framer-motion `motion.*`
 * element app-wide, but native browser APIs like `window.scrollTo({
 * behavior: 'smooth' })` aren't framer-motion and don't know about that
 * setting -- call sites using those directly should check this first. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** 'smooth' unless the viewer has asked for reduced motion, in which case a
 * plain instant jump -- for the few spots that call scrollTo directly. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth'
}
