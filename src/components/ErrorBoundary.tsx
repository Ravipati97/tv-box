import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time exceptions anywhere below it in the tree so one bad
 * component can't white-screen the whole app -- shows a recoverable
 * "something broke" screen with a reload button instead. Error boundaries
 * have to be class components; React has no hook equivalent.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-base-950 px-6 text-center">
          <div className="text-4xl">⚠️</div>
          <p className="max-w-xs text-sm text-base-400">
            Something went wrong. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-accent-500/15 px-4 py-2 text-sm font-medium text-accent-300 ring-1 ring-accent-500/40"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
