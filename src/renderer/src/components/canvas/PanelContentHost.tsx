import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@renderer/components/shared/Button'
import {
  formatIssuePayload,
  IssueCopyButton
} from '@renderer/components/shared/IssueCopyButton'
import {
  usePanelRuntimeStore,
  type PanelFailureState
} from '@renderer/stores/panel-runtime.store'

function formatFailureDebug(error: Error): string {
  const message = error.message?.trim() ? error.message.trim() : 'Unknown renderer error.'
  return error.stack?.trim() ? `${message}\n\n${error.stack.trim()}` : message
}

class PanelContentBoundary extends Component<
  {
    panelId: string
    onFailure: (panelId: string, failure: PanelFailureState) => void
    children: ReactNode
  },
  { hasError: boolean }
> {
  state = {
    hasError: false
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PanelContentBoundary] panel render failure', error, errorInfo)
    this.props.onFailure(this.props.panelId, {
      source: 'render',
      summary: 'This panel crashed while rendering.',
      debug: formatFailureDebug(error),
      occurredAt: Date.now()
    })
  }

  render() {
    if (this.state.hasError) {
      return null
    }

    return this.props.children
  }
}

function DebugDetails({
  debug,
  defaultOpen
}: {
  debug?: string | null
  defaultOpen: boolean
}) {
  if (!debug?.trim()) {
    return null
  }

  return (
    <details
      className="mt-4 rounded-md border border-border-subtle bg-bg px-3 py-2 text-left"
      open={defaultOpen}
    >
      <summary className="cursor-pointer text-xs font-medium text-text-primary">
        Debug details
      </summary>
      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap select-text text-[11px] leading-5 text-text-secondary">
        {debug}
      </pre>
    </details>
  )
}

function PanelFailureView({
  failure,
  onRetry
}: {
  failure: PanelFailureState
  onRetry: () => void
}) {
  const issuePayload = formatIssuePayload('Panel unavailable', failure.summary, failure.debug)

  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div className="w-full max-w-xl rounded-xl border border-danger/25 bg-bg-raised px-5 py-4 text-left shadow-lg shadow-black/20">
        <p className="select-text text-sm font-semibold text-danger">Panel unavailable</p>
        <p className="mt-2 select-text text-xs leading-5 text-text-secondary">{failure.summary}</p>
        <p className="mt-2 select-text text-[11px] uppercase tracking-wide text-text-muted">
          You can retry this panel or close it from the header.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
          <IssueCopyButton payload={issuePayload} />
        </div>
        <DebugDetails debug={failure.debug} defaultOpen={Boolean(import.meta.env.DEV)} />
      </div>
    </div>
  )
}

export function PanelContentHost({
  panelId,
  children
}: {
  panelId: string
  children: ReactNode
}) {
  const runtime = usePanelRuntimeStore((state) => state.panelRuntimeById[panelId])
  const setPanelFailure = usePanelRuntimeStore((state) => state.setPanelFailure)
  const retryPanel = usePanelRuntimeStore((state) => state.retryPanel)
  const panelFailure = runtime?.panelFailure
  const recoveryNonce = runtime?.recoveryNonce ?? 0

  if (panelFailure) {
    return <PanelFailureView failure={panelFailure} onRetry={() => retryPanel(panelId)} />
  }

  return (
    <PanelContentBoundary
      key={`${panelId}:${recoveryNonce}`}
      panelId={panelId}
      onFailure={setPanelFailure}
    >
      {children}
    </PanelContentBoundary>
  )
}
