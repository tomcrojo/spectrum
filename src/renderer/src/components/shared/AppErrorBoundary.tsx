import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import { formatIssuePayload, IssueCopyButton } from './IssueCopyButton'

interface AppErrorBoundaryState {
  error: Error | null
}

function formatDebug(error: Error): string {
  const message = error.message?.trim() ? error.message.trim() : 'Unknown application error.'
  return error.stack?.trim() ? `${message}\n\n${error.stack.trim()}` : message
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError)
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError)
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] root render failure', error, errorInfo)
  }

  handleWindowError = (event: ErrorEvent) => {
    console.error('[AppErrorBoundary] window error', event.error ?? event.message, event)
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('[AppErrorBoundary] unhandled rejection', event.reason)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    const issuePayload = formatIssuePayload(
      'Spectrum unrecoverable UI error',
      'Reload the app to restore the project canvas. Persisted workspace layout will be restored, but transient panel state may be lost.',
      formatDebug(this.state.error)
    )

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-2xl rounded-2xl border border-danger/25 bg-bg-raised px-6 py-5 shadow-2xl shadow-black/30">
          <p className="select-text text-sm font-semibold text-danger">Spectrum hit an unrecoverable UI error</p>
          <p className="mt-2 select-text text-sm leading-6 text-text-secondary">
            Reload the app to restore the project canvas. Persisted workspace layout will be restored, but transient panel state may be lost.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload app
            </Button>
            <IssueCopyButton payload={issuePayload} />
          </div>
          <details
            className="mt-5 rounded-md border border-border-subtle bg-bg px-3 py-2"
            open={Boolean(import.meta.env.DEV)}
          >
            <summary className="cursor-pointer text-xs font-medium text-text-primary">
              Debug details
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap select-text text-[11px] leading-5 text-text-secondary">
              {formatDebug(this.state.error)}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
