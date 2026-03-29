import type { PanelType } from '@shared/workspace.types'

interface PanelPlaceholderProps {
  type: Extract<PanelType, 'browser' | 'chat'>
}

const copy = {
  browser: {
    title: 'Browser panel',
    description: 'Browser sessions are not wired yet. This panel is a placeholder for the upcoming webview flow.'
  },
  chat: {
    title: 'Chat panel',
    description: 'Chat orchestration is not wired yet. This panel marks where the provider conversation UI will live.'
  }
} as const

export function PanelPlaceholder({ type }: PanelPlaceholderProps) {
  const content = copy[type]

  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <div className="max-w-sm rounded-xl border border-dashed border-border-subtle bg-bg-raised px-5 py-4 text-center">
        <p className="text-sm font-medium text-text-primary">{content.title}</p>
        <p className="mt-2 text-xs leading-5 text-text-muted">{content.description}</p>
      </div>
    </div>
  )
}
