import {
  Cancel01FreeIcons,
  DashboardSquare02FreeIcons,
  FolderCodeFreeIcons,
  SparklesFreeIcons
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@renderer/components/shared/Button'
import {
  useUiStore,
  type ArchivedTimestampFormat,
  type CanvasInteractionMode,
  type FollowUpBehavior,
  type RuntimePowerMode,
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
    description: 'Use the light theme across Spectrum and T3Code.'
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Use the dark theme across Spectrum and T3Code.'
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

const canvasInteractionModeOptions: Array<{
  value: CanvasInteractionMode
  label: string
  description: string
  warning?: string
}> = [
  {
    value: 'structured',
    label: 'Structured view',
    description: 'Default layout with fixed 100% scale and predictable workspace navigation.'
  },
  {
    value: 'free',
    label: 'Free canvas',
    description: 'Enables zoom, fit-to-content, and drag-panning across the workspace grid.',
    warning: 'Higher GPU activity can reduce battery life and hurt performance on larger projects.'
  }
]

const runtimePowerModeOptions: Array<{
  value: RuntimePowerMode
  label: string
  description: string
}> = [
  {
    value: 'high',
    label: 'High',
    description: 'Keeps browser and T3 panels live more often for the smoothest switching and best agent access.'
  },
  {
    value: 'mid',
    label: 'Mid',
    description: 'Applies lazy restore and background monitoring, but only parks heavy panels when a workspace goes inactive.'
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Parks heavy panels aggressively to reduce steady-state CPU, memory, and battery cost on large projects.'
  }
]

const followUpBehaviorOptions: Array<{
  value: FollowUpBehavior
  label: string
  description: string
}> = [
  {
    value: 'queue',
    label: 'Queue',
    description: 'Queue follow-ups while Codex runs.'
  },
  {
    value: 'steer',
    label: 'Steer',
    description: 'Send follow-ups immediately to steer the current run.'
  }
]

const assistantStreamingOptions = [
  {
    value: true,
    label: 'Live',
    description: 'Stream assistant text into T3Code as it is generated.'
  },
  {
    value: false,
    label: 'Buffered',
    description: 'Only show assistant text after each response completes.'
  }
] as const

function SettingsIcon({
  icon
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
}) {
  return <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
}

function SettingsSection({
  icon,
  title,
  description,
  status,
  children
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  title: string
  description: string
  status?: string
  children: React.ReactNode
}) {
  return (
    <section className="app-settings-card rounded-[1.4rem] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-accent/8 p-2 text-accent">
            <SettingsIcon icon={icon} />
          </span>
          <div>
            <h3 className="text-sm font-medium tracking-tight text-text-primary">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
          </div>
        </div>
        {status ? (
          <div className="app-settings-pill rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]">
            {status}
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2">{children}</div>
    </section>
  )
}

function SettingsOption({
  selected,
  label,
  description,
  warning,
  onClick
}: {
  selected: boolean
  label: string
  description: string
  warning?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'app-settings-option rounded-[1.1rem] px-3.5 py-3 text-left',
        selected && 'app-settings-option-active'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span
          className={cn(
            'h-2.5 w-2.5 rounded-full border',
            selected
              ? 'border-accent bg-accent'
              : 'border-border bg-transparent'
          )}
        />
      </div>
      <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
      {warning ? (
        <p className="mt-2 rounded-[0.9rem] border border-warning/30 bg-warning/8 px-2.5 py-2 text-[11px] leading-5 text-text-secondary">
          Warning: {warning}
        </p>
      ) : null}
    </button>
  )
}

export function SettingsPage() {
  const {
    showSettingsPage,
    setShowSettingsPage,
    theme,
    setTheme,
    archivedTimestampFormat,
    setArchivedTimestampFormat,
    autoCenterFocusedPanel,
    setAutoCenterFocusedPanel,
    canvasInteractionMode,
    setCanvasInteractionMode,
    runtimePowerMode,
    setRuntimePowerMode,
    followUpBehavior,
    setFollowUpBehavior,
    assistantStreaming,
    setAssistantStreaming
  } = useUiStore()
  const resolvedTheme = useResolvedTheme()

  if (!showSettingsPage) {
    return null
  }

  const handleCanvasInteractionModeChange = (mode: CanvasInteractionMode) => {
    if (mode === canvasInteractionMode) {
      return
    }

    if (mode === 'free') {
      const confirmed = window.confirm(
        'Free canvas uses more GPU and can increase battery drain. Enable it anyway?'
      )

      if (!confirmed) {
        return
      }
    }

    setCanvasInteractionMode(mode)
  }

  return (
    <div className="app-glass-panel app-settings-shell ml-2 mr-2 flex h-[calc(100%-16px)] w-[460px] flex-shrink-0 self-center overflow-hidden rounded-[1.7rem]">
      <div className="relative flex h-full w-full flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Settings
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              Appearance and app-level behavior.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 rounded-full p-0"
            onClick={() => setShowSettingsPage(false)}
          >
            <SettingsIcon icon={Cancel01FreeIcons} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="space-y-4">
            <SettingsSection
              icon={SparklesFreeIcons}
              title="Theme"
              description="Controls Spectrum and the embedded T3Code panel from one setting."
              status={`Active ${resolvedTheme}`}
            >
              {themeOptions.map((option) => (
                <SettingsOption
                  key={option.value}
                  selected={theme === option.value}
                  label={option.label}
                  description={option.description}
                  onClick={() => setTheme(option.value)}
                />
              ))}

              <div className="flex items-center justify-between rounded-[1.1rem] border border-border/80 bg-bg-surface/62 px-3.5 py-3">
                <div>
                  <p className="text-xs font-medium text-text-primary">Current output</p>
                  <p className="mt-1 text-xs text-text-muted">
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
            </SettingsSection>

            <SettingsSection
              icon={DashboardSquare02FreeIcons}
              title="Follow-up Behavior"
              description="Queue follow-ups while Codex runs or steer the current run. Press ⇧⌘Enter to do the opposite for one message."
              status={followUpBehavior}
            >
              {followUpBehaviorOptions.map((option) => (
                <SettingsOption
                  key={option.value}
                  selected={followUpBehavior === option.value}
                  label={option.label}
                  description={option.description}
                  onClick={() => setFollowUpBehavior(option.value)}
                />
              ))}
            </SettingsSection>

            <SettingsSection
              icon={SparklesFreeIcons}
              title="Assistant Output"
              description="Controls whether the embedded T3Code panel renders assistant text live or waits for the full reply."
              status={assistantStreaming ? 'Live' : 'Buffered'}
            >
              {assistantStreamingOptions.map((option) => (
                <SettingsOption
                  key={option.label}
                  selected={assistantStreaming === option.value}
                  label={option.label}
                  description={option.description}
                  onClick={() => setAssistantStreaming(option.value)}
                />
              ))}
            </SettingsSection>

            <SettingsSection
              icon={FolderCodeFreeIcons}
              title="Runtime Lifecycle"
              description="Controls how aggressively inactive heavy panels are parked to save resources."
              status={runtimePowerMode}
            >
              {runtimePowerModeOptions.map((option) => (
                <SettingsOption
                  key={option.value}
                  selected={runtimePowerMode === option.value}
                  label={option.label}
                  description={option.description}
                  onClick={() => setRuntimePowerMode(option.value)}
                />
              ))}
            </SettingsSection>

            <SettingsSection
              icon={DashboardSquare02FreeIcons}
              title="Workspace View"
              description="Structured view is the default. Free canvas is available as an opt-in."
              status={canvasInteractionMode === 'structured' ? 'Default' : 'Opt-in'}
            >
              {canvasInteractionModeOptions.map((option) => (
                <SettingsOption
                  key={option.value}
                  selected={canvasInteractionMode === option.value}
                  label={option.label}
                  description={option.description}
                  warning={option.warning}
                  onClick={() => handleCanvasInteractionModeChange(option.value)}
                />
              ))}
            </SettingsSection>

            <SettingsSection
              icon={SparklesFreeIcons}
              title="Focus Camera"
              description="Choose whether focusing a panel recenters the canvas or keeps your current overview."
              status={autoCenterFocusedPanel ? 'Auto-center' : "Bird's-eye"}
            >
              <SettingsOption
                selected={autoCenterFocusedPanel}
                label="Auto-center focused panel"
                description="Keeps the active panel centered, including with blank space around the canvas edges."
                onClick={() => setAutoCenterFocusedPanel(true)}
              />
              <SettingsOption
                selected={!autoCenterFocusedPanel}
                label="Keep bird's-eye view"
                description="Focus changes stay local so you can watch several panels without the camera moving."
                onClick={() => setAutoCenterFocusedPanel(false)}
              />
            </SettingsSection>

            <SettingsSection
              icon={FolderCodeFreeIcons}
              title="Archived Panel Timestamps"
              description="Controls how archived workspaces describe the most recent panel edit."
              status={archivedTimestampFormat === 'relative' ? 'Relative' : 'Full date'}
            >
              {archivedTimestampOptions.map((option) => (
                <SettingsOption
                  key={option.value}
                  selected={archivedTimestampFormat === option.value}
                  label={option.label}
                  description={option.description}
                  onClick={() => setArchivedTimestampFormat(option.value)}
                />
              ))}
            </SettingsSection>

            <section className="app-settings-card rounded-[1.4rem] p-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                Acknowledgements
              </h3>
              <p className="mt-3 text-xs leading-6 text-text-muted">
                Spectrum stands on the shoulders of projects that shaped its direction. Huge thanks to{' '}
                <a
                  href="https://github.com/pingdotgg/t3code"
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary"
                >
                  T3Code
                </a>
                ,{' '}
                <a
                  href="https://github.com/SawyerHood/dev-browser"
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary"
                >
                  dev-browser CLI
                </a>
                ,{' '}
                <a
                  href="https://github.com/galz10/IDX0"
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary"
                >
                  idx0
                </a>
                , and{' '}
                <a
                  href="https://github.com/manaflow-ai/cmux"
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-secondary underline underline-offset-2 transition-colors hover:text-text-primary"
                >
                  cmux
                </a>{' '}
                for their ideas and inspiration.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
