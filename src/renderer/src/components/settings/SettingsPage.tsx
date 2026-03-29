import { Button } from '@renderer/components/shared/Button'
import {
  useUiStore,
  type ArchivedTimestampFormat,
  type UiTheme
} from '@renderer/stores/ui.store'
import { useResolvedTheme } from '@renderer/lib/theme'
import { cn } from '@renderer/lib/cn'

const themeOptions: Array<{
  value: UiTheme
  label: string
  description: string
}> = [
  {
    value: 'system',
    label: 'System',
    description: 'Follow the OS appearance setting.'
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Use the light theme across Centipede and T3Code.'
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Use the dark theme across Centipede and T3Code.'
  }
]

const archivedTimestampOptions: Array<{
  value: ArchivedTimestampFormat
  label: string
  description: string
}> = [
  {
    value: 'relative',
    label: 'Relative',
    description: 'Show archived panel edits as relative times like 2 hours ago.'
  },
  {
    value: 'full',
    label: 'Full date',
    description: 'Show the exact local date and time for archived panel edits.'
  }
]

export function SettingsPage() {
  const {
    showSettingsPage,
    setShowSettingsPage,
    theme,
    setTheme,
    archivedTimestampFormat,
    setArchivedTimestampFormat
  } = useUiStore()
  const resolvedTheme = useResolvedTheme()

  if (!showSettingsPage) {
    return null
  }

  return (
    <div className="w-[420px] flex-shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Settings
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Appearance and app-level behavior.
          </p>
        </div>
        <button
          onClick={() => setShowSettingsPage(false)}
          className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-hover"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <section className="rounded-xl border border-border bg-bg-raised p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Theme</h3>
              <p className="mt-1 text-xs text-text-muted">
                Controls Centipede and the embedded T3Code panel from one setting.
              </p>
            </div>
            <div className="rounded-full border border-border-subtle bg-bg px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
              Active {resolvedTheme}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {themeOptions.map((option) => {
              const selected = theme === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left transition-colors',
                    selected
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-bg hover:bg-bg-hover'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-text-primary">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border',
                        selected
                          ? 'border-accent bg-accent'
                          : 'border-border bg-transparent'
                      )}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {option.description}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-border-subtle bg-bg px-3 py-2">
            <div>
              <p className="text-xs font-medium text-text-primary">Current output</p>
              <p className="text-xs text-text-muted">
                Resolved to {resolvedTheme} mode.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme('system')}
              disabled={theme === 'system'}
            >
              Reset
            </Button>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-bg-raised p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Archived Panel Timestamps
              </h3>
              <p className="mt-1 text-xs text-text-muted">
                Controls how archived workspaces describe the most recent panel edit.
              </p>
            </div>
            <div className="rounded-full border border-border-subtle bg-bg px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
              {archivedTimestampFormat === 'relative' ? 'Relative' : 'Full date'}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {archivedTimestampOptions.map((option) => {
              const selected = archivedTimestampFormat === option.value

              return (
                <button
                  key={option.value}
                  onClick={() => setArchivedTimestampFormat(option.value)}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left transition-colors',
                    selected
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-bg hover:bg-bg-hover'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-text-primary">
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full border',
                        selected
                          ? 'border-accent bg-accent'
                          : 'border-border bg-transparent'
                      )}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {option.description}
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
