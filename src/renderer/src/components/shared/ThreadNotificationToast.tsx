import { useEffect } from 'react'
import { cn } from '@renderer/lib/cn'
import { useNotificationsStore, type ThreadNotification } from '@renderer/stores/notifications.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

const TOAST_AUTO_DISMISS_MS = 6000

function SingleToast({
  toast,
  onDismiss,
  onFocus
}: {
  toast: ThreadNotification
  onDismiss: () => void
  onFocus: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss()
    }, TOAST_AUTO_DISMISS_MS)

    return () => clearTimeout(timer)
  }, [onDismiss])

  const isRequiresInput = toast.kind === 'requires-input'

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border shadow-xl px-3.5 py-3 w-72 animate-in slide-in-from-right-4 fade-in duration-200',
        'bg-bg-raised text-text-primary',
        isRequiresInput ? 'border-amber-500/30' : 'border-sky-500/30'
      )}
    >
      {/* Color dot */}
      <span
        className={cn(
          'mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ring-4',
          isRequiresInput
            ? 'bg-amber-400 ring-amber-500/20'
            : 'bg-sky-400 ring-sky-500/20'
        )}
      />

      {/* Content */}
      <button
        type="button"
        onClick={onFocus}
        className="flex-1 min-w-0 text-left"
      >
        <p className={cn(
          'text-xs font-medium',
          isRequiresInput ? 'text-amber-300' : 'text-sky-300'
        )}>
          {isRequiresInput ? 'Awaiting your input' : 'Thread completed'}
        </p>
        <p className="mt-0.5 text-xs text-text-secondary truncate">
          {toast.panelTitle}
        </p>
      </button>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors mt-0.5"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 3L9 9M9 3L3 9"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  )
}

export function ThreadNotificationToasts() {
  const toasts = useNotificationsStore((state) => state.toasts)
  const dismissToast = useNotificationsStore((state) => state.dismissToast)
  const setFocusedPanel = useWorkspacesStore((state) => state.setFocusedPanel)
  const focusWorkspace = useWorkspacesStore((state) => state.focusWorkspace)

  if (toasts.length === 0) {
    return null
  }

  const handleFocus = (toast: ThreadNotification) => {
    focusWorkspace(toast.workspaceId)
    setFocusedPanel(toast.panelId)
    dismissToast(toast.id)
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <SingleToast
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
            onFocus={() => handleFocus(toast)}
          />
        </div>
      ))}
    </div>
  )
}
