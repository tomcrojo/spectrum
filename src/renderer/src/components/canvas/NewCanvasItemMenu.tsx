import { cn } from '@renderer/lib/cn'

interface MenuOption {
  label: string
  description: string
  onSelect: () => void
}

interface NewCanvasItemMenuProps {
  open: boolean
  onClose: () => void
  panelOptions: MenuOption[]
  workspaceOption: MenuOption
}

export function NewCanvasItemMenu({
  open,
  onClose,
  panelOptions,
  workspaceOption
}: NewCanvasItemMenuProps) {
  if (!open) {
    return null
  }

  return (
    <>
      <button
        aria-label="Close new item menu"
        className="fixed inset-0 z-20 cursor-default"
        onClick={onClose}
      />
      <div className="absolute left-0 top-11 z-30 w-72 rounded-xl border border-border bg-bg-raised p-2 shadow-2xl shadow-black/35">
        <div className="px-2 pb-2 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            New Panel
          </p>
        </div>

        <div className="space-y-1">
          {panelOptions.map((option) => (
            <button
              key={option.label}
              onClick={option.onSelect}
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left transition-colors',
                'hover:bg-bg-hover'
              )}
            >
              <div className="text-sm font-medium text-text-primary">{option.label}</div>
              <div className="mt-1 text-xs leading-4 text-text-muted">{option.description}</div>
            </button>
          ))}
        </div>

        <div className="my-2 border-t border-border-subtle" />

        <div className="px-2 pb-2 pt-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            New Workspace
          </p>
        </div>

        <button
          onClick={workspaceOption.onSelect}
          className={cn(
            'w-full rounded-lg px-3 py-2 text-left transition-colors',
            'hover:bg-bg-hover'
          )}
        >
          <div className="text-sm font-medium text-text-primary">{workspaceOption.label}</div>
          <div className="mt-1 text-xs leading-4 text-text-muted">{workspaceOption.description}</div>
        </button>
      </div>
    </>
  )
}
