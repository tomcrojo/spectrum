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
    setArchivedTimestampFormat,
    autoCenterFocusedPanel,
    setAutoCenterFocusedPanel
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
                Focus Camera
              </h3>
              <p className="mt-1 text-xs text-text-muted">
                Choose whether focusing a panel recenters the canvas or keeps your current overview.
              </p>
            </div>
            <div className="rounded-full border border-border-subtle bg-bg px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
              {autoCenterFocusedPanel ? 'Auto-center' : 'Bird’s-eye'}
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <button
              onClick={() => setAutoCenterFocusedPanel(true)}
              className={cn(
                'rounded-lg border px-3 py-3 text-left transition-colors',
                autoCenterFocusedPanel
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-bg hover:bg-bg-hover'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-primary">
                  Auto-center focused panel
                </span>
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full border',
                    autoCenterFocusedPanel
                      ? 'border-accent bg-accent'
                      : 'border-border bg-transparent'
                  )}
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Keeps the active panel centered, including with blank space around the canvas edges.
              </p>
            </button>

            <button
              onClick={() => setAutoCenterFocusedPanel(false)}
              className={cn(
                'rounded-lg border px-3 py-3 text-left transition-colors',
                !autoCenterFocusedPanel
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-bg hover:bg-bg-hover'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-primary">
                  Keep bird’s-eye view
                </span>
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full border',
                    !autoCenterFocusedPanel
                      ? 'border-accent bg-accent'
                      : 'border-border bg-transparent'
                  )}
                />
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Focus changes stay local so you can watch several panels without the camera moving.
              </p>
            </button>
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

        <section className="mt-6 mb-2 px-1">
          <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.16em] mb-3">
            Acknowledgements
          </h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Centipede stands on the shoulders of projects that shaped its
            direction. Huge thanks to{' '}
            <a
              href="https://github.com/nicepkg/aide"
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2"
            >
              T3Code
            </a>
            ,{' '}
            <a
              href="https://github.com/pAIrprogio/cmux"
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2"
            >
              cmux
            </a>
            ,{' '}
            <a
              href="https://github.com/nicepkg/dev-browser"
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2"
            >
              dev-browser CLI
            </a>
            , and{' '}
            <a
              href="https://github.com/nicepkg/idx0"
              target="_blank"
              rel="noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors underline underline-offset-2"
            >
              idx0
            </a>{' '}
            for their ideas and inspiration.
          </p>
        </section>
      </div>
    </div>
  )
}
