import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01FreeIcons,
  AiSearchFreeIcons,
  AiSettingFreeIcons,
  ArrowRight01FreeIcons,
  BubbleChatSparkFreeIcons,
  CheckmarkCircle02FreeIcons,
  DashboardSquare02FreeIcons,
  FolderCodeFreeIcons
} from '@hugeicons/core-free-icons'
import { ProjectAvatar } from '@renderer/components/shared/ProjectAvatar'
import { Button as LegacyButton } from '@renderer/components/shared/Button'
import { Input as LegacyInput } from '@renderer/components/shared/Input'
import { ProgressIcon } from '@renderer/components/shared/ProgressIcon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/lib/cn'
import type { ProjectColor } from '@shared/project.types'

type PreviewTheme = 'light' | 'dark'

interface MockProject {
  name: string
  description: string
  status: string
  color: ProjectColor
  icon: { type: 'icon'; value: 'spark' | 'folder' | 'terminal' | 'planet' | 'rocket' | 'grid' | 'chip' | 'book' }
}

const mockProjects: MockProject[] = [
  {
    name: 'Spectrum',
    description: 'Shell and project cockpit',
    status: '3 active workspaces',
    color: 'northern-lights',
    icon: { type: 'icon', value: 'spark' }
  },
  {
    name: 'Relay',
    description: 'Provider bridge refactor',
    status: '2 decisions pending',
    color: 'sea-glass',
    icon: { type: 'icon', value: 'terminal' }
  },
  {
    name: 'Helix',
    description: 'Browser runtime experiments',
    status: 'Research mode',
    color: 'wild-rose',
    icon: { type: 'icon', value: 'planet' }
  }
]

const mockTasks = [
  'Refactor sidebar with native-feeling chrome',
  'Carry the Luma typography and spacing system into project details',
  'Keep embedded panels visually untouched for phase one'
]

function LumaIcon({
  icon,
  className,
  primaryColor,
  secondaryColor,
  size = 18
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  className?: string
  primaryColor?: string
  secondaryColor?: string
  size?: number
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={1.8}
      className={className}
      primaryColor={primaryColor}
      secondaryColor={secondaryColor}
    />
  )
}

function SectionLabel({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
        {eyebrow}
      </span>
      <h2 className="text-xl font-medium tracking-tight text-foreground">{title}</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function PreviewPanel({
  label,
  caption,
  children,
  mode = 'after'
}: {
  label: string
  caption: string
  children: React.ReactNode
  mode?: 'before' | 'after'
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{label}</CardTitle>
            <CardDescription className="mt-1">{caption}</CardDescription>
          </div>
          <Badge variant={mode === 'after' ? 'default' : 'secondary'}>
            {mode === 'after' ? 'Luma Proposal' : 'Current UI'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

function LegacySidebarPreview({ theme }: { theme: PreviewTheme }) {
  return (
    <div className={cn('legacy-preview-theme h-[720px] w-full overflow-hidden', theme)}>
      <div className="flex h-full flex-col border-r border-border bg-bg-raised text-text-primary">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
            Projects
          </span>
          <button className="rounded-md p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary">
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
              <path
                d="M8.75 3.25L5.25 7L8.75 10.75"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-1 px-2 py-3">
          {mockProjects.map((project, index) => {
            const active = index === 0
            return (
              <button
                key={project.name}
                className={cn(
                  'w-full rounded-lg border px-3 py-2.5 text-left transition-all',
                  active
                    ? 'border-border bg-bg-active'
                    : 'border-transparent hover:bg-bg-hover'
                )}
              >
                <div className="flex items-start gap-2">
                  <ProjectAvatar icon={project.icon} name={project.name} color={project.color} size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text-primary">
                      {project.name}
                    </div>
                    <div className="mt-1 truncate text-xs text-text-muted">
                      {project.status} · {project.description}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex h-8 w-5 items-center justify-center rounded-md transition-opacity',
                      active ? 'bg-accent text-white' : 'opacity-40'
                    )}
                  >
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M4.5 3L7.5 6L4.5 9"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="space-y-2 border-t border-border-subtle p-2">
          <LegacyButton variant="ghost" className="w-full justify-start gap-2">
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 2.5V11.5M2.5 7H11.5"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </svg>
            New Project
          </LegacyButton>
          <LegacyButton variant="ghost" className="w-full justify-start gap-2">
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1.75L8.02 2.18L9.1 1.8L10.15 2.85L9.77 3.93L10.2 4.95L11.35 5.45V6.55L10.2 7.05L9.77 8.07L10.15 9.15L9.1 10.2L8.02 9.82L7 10.25L6.5 11.4H5.4L4.9 10.25L3.88 9.82L2.8 10.2L1.75 9.15L2.13 8.07L1.7 7.05L0.55 6.55V5.45L1.7 4.95L2.13 3.93L1.75 2.85L2.8 1.8L3.88 2.18L4.9 1.75L5.4 0.6H6.5L7 1.75Z"
                stroke="currentColor"
                strokeWidth={1.1}
                strokeLinejoin="round"
              />
              <circle cx="5.95" cy="6" r="1.65" stroke="currentColor" strokeWidth={1.1} />
            </svg>
            Settings
          </LegacyButton>
        </div>
      </div>
    </div>
  )
}

function LumaSidebarPreview() {
  return (
    <div className="style-lab-frost style-lab-sidebar h-[720px] w-full overflow-hidden rounded-[1.9rem] border border-border/70 bg-sidebar/88 text-sidebar-foreground shadow-[0_40px_100px_-48px_rgba(8,15,31,0.65)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="style-lab-prism-chip">
              <span className="style-lab-prism-dot" />
            </div>
            <div>
              <div className="text-sm font-medium tracking-tight text-sidebar-foreground">
                Spectrum
              </div>
              <div className="text-xs text-sidebar-foreground/55">Project cockpit</div>
            </div>
          </div>
          <Button variant="outline" size="icon-sm" className="bg-background/60">
            <LumaIcon icon={AiSearchFreeIcons} />
          </Button>
        </div>

        <div className="px-4">
          <button className="style-lab-native-button flex w-full items-center justify-between rounded-[1.2rem] px-4 py-3 text-left">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-primary/12 p-2 text-primary">
                <LumaIcon icon={Add01FreeIcons} size={16} />
              </span>
              <div>
                <div className="text-sm font-medium">Add project</div>
                <div className="text-xs text-sidebar-foreground/55">Create a cockpit</div>
              </div>
            </div>
            <LumaIcon icon={ArrowRight01FreeIcons} className="text-sidebar-foreground/50" />
          </button>
        </div>

        <div className="mt-4 flex-1 px-4 pb-4">
          <div className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.22em] text-sidebar-foreground/48">
            Navigator
          </div>
          <div className="space-y-2">
            {mockProjects.map((project, index) => {
              const active = index === 0
              return (
                <button
                  key={project.name}
                  className={cn(
                    'style-lab-nav-row w-full rounded-[1.25rem] px-3 py-3 text-left',
                    active && 'style-lab-nav-row-active'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <ProjectAvatar
                      icon={project.icon}
                      name={project.name}
                      color={project.color}
                      size={22}
                      className={cn(active && 'ring-1 ring-white/20')}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium tracking-tight">
                          {project.name}
                        </span>
                        {active ? (
                          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                            Focused
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-xs text-sidebar-foreground/58">
                        {project.status}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="border-t border-sidebar-border/70 px-4 py-4">
          <button className="style-lab-nav-row flex w-full items-center gap-3 rounded-[1.15rem] px-3 py-3 text-sm text-left">
            <span className="rounded-full bg-background/70 p-2 text-sidebar-foreground/72">
              <LumaIcon icon={AiSettingFreeIcons} size={16} />
            </span>
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function LegacyProjectPagePreview({ theme }: { theme: PreviewTheme }) {
  return (
    <div className={cn('legacy-preview-theme h-[760px] w-full overflow-hidden', theme)}>
      <div className="h-full border border-border-subtle bg-bg-surface text-text-primary">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Project Details
          </h2>
          <button className="rounded p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary">
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3L11 11M11 3L3 11"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-8 px-4 py-4">
          <div>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <ProjectAvatar icon={mockProjects[0].icon} name="Spectrum" color="northern-lights" size={40} />
                <div>
                  <h1 className="text-xl font-bold text-text-primary">Spectrum</h1>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                    <span>Change icon</span>
                    <span>~Cobalt Glow</span>
                  </div>
                </div>
              </div>
              <button className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary">
                <ProgressIcon progress={2} size={16} />
                Almost Done
              </button>
            </div>

            <p className="text-sm text-text-secondary">
              Desktop cockpit for coding work with projects, workspaces, terminals, and agent flows.
            </p>

            <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
              <span>/Users/tomascampoy/Documents/spectrum</span>
              <span className="rounded border border-border bg-bg px-1.5 py-0.5 text-text-secondary">
                git workspaces
              </span>
            </div>
          </div>

          <section className="border-b border-border-subtle pb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Open Workspaces
            </h3>
            <div className="space-y-2">
              {['Workspace 1', 'Workspace 2', 'Workspace 3'].map((name) => (
                <div key={name} className="rounded-lg border border-border bg-bg px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{name}</div>
                      <div className="mt-1 text-xs text-text-muted">T3Code · Browser · Terminal</div>
                    </div>
                    <LegacyButton variant="ghost" size="sm">
                      Open
                    </LegacyButton>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-b border-border-subtle pb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Tasks
            </h3>
            <div className="space-y-2">
              {mockTasks.map((task, index) => (
                <div key={task} className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2.5">
                  <span
                    className={cn(
                      'h-4 w-4 rounded-full border',
                      index === 0 ? 'border-success bg-success/80' : 'border-border'
                    )}
                  />
                  <span className="text-sm text-text-primary">{task}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="border-b border-border-subtle pb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Notes
            </h3>
            <p className="text-xs text-text-muted">Coming in Phase 4</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function LumaProjectPagePreview() {
  return (
    <div className="style-lab-frost h-[760px] w-full overflow-hidden rounded-[2rem] border border-border/70 bg-card/88 text-card-foreground shadow-[0_44px_110px_-56px_rgba(15,23,42,0.72)]">
      <div className="relative h-full overflow-hidden">
        <div className="style-lab-beam absolute inset-x-0 top-0 h-28" />
        <div className="relative h-full overflow-y-auto px-6 py-6">
          <div className="mb-5 flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <ProjectAvatar
                icon={mockProjects[0].icon}
                name="Spectrum"
                color="northern-lights"
                size={48}
                className="ring-1 ring-white/20"
              />
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge>Focused</Badge>
                  <Badge variant="outline">Git workspaces</Badge>
                </div>
                <h1 className="text-[28px] font-medium tracking-tight text-foreground">
                  Spectrum
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Desktop cockpit for coding work with projects, workspaces, terminals, browser panels, and agent flows.
                </p>
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-background/68 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ProgressIcon progress={2} size={16} className="text-primary" />
                Almost Done
              </div>
              <div className="mt-1 text-xs text-muted-foreground">3 workspaces · 5 tasks · 1 decision</div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <section className="style-lab-panel rounded-[1.65rem] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium tracking-tight">Workspaces</div>
                    <div className="text-xs text-muted-foreground">
                      Open surfaces orbiting this project
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <span data-icon="inline-start">
                      <LumaIcon icon={Add01FreeIcons} size={14} />
                    </span>
                    New Workspace
                  </Button>
                </div>
                <div className="space-y-3">
                  {[
                    ['Main cockpit', 'T3Code · Browser · Terminal', 'Active'],
                    ['Provider tests', 'T3Code · File panel', 'Saved'],
                    ['Research stream', 'Browser · Notes', 'Parked']
                  ].map(([name, detail, state], index) => (
                    <div
                      key={name}
                      className={cn(
                        'rounded-[1.25rem] border px-4 py-3',
                        index === 0
                          ? 'border-primary/22 bg-primary/10'
                          : 'border-border/70 bg-background/62'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
                        </div>
                        <Badge variant={index === 0 ? 'default' : 'secondary'}>{state}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="style-lab-panel rounded-[1.65rem] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium tracking-tight">Execution Tasks</div>
                    <div className="text-xs text-muted-foreground">What ships this overhaul</div>
                  </div>
                  <Button variant="secondary" size="sm">
                    Capture
                  </Button>
                </div>
                <div className="space-y-2.5">
                  {mockTasks.map((task, index) => (
                    <div
                      key={task}
                      className="flex items-center gap-3 rounded-[1.2rem] border border-border/70 bg-background/62 px-4 py-3"
                    >
                      <span
                        className={cn(
                          'inline-flex rounded-full p-1',
                          index === 0
                            ? 'bg-primary/14 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <LumaIcon
                          icon={CheckmarkCircle02FreeIcons}
                          size={14}
                          primaryColor={index === 0 ? 'currentColor' : 'currentColor'}
                        />
                      </span>
                      <span className="text-sm">{task}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className="style-lab-panel rounded-[1.65rem] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <span className="rounded-full bg-primary/12 p-2 text-primary">
                    <LumaIcon icon={FolderCodeFreeIcons} size={16} />
                  </span>
                  <div>
                    <div className="text-sm font-medium tracking-tight">Project Signals</div>
                    <div className="text-xs text-muted-foreground">
                      Gentle hierarchy, stronger scanability
                    </div>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-[1.2rem] border border-border/70 bg-background/62 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
                      Repo
                    </div>
                    <div className="mt-2 text-foreground">
                      /Users/tomascampoy/Documents/spectrum
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] border border-border/70 bg-background/62 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
                      Color system
                    </div>
                    <div className="mt-2 text-foreground">
                      Neutral base + monochrome accent + emerald charts
                    </div>
                  </div>
                </div>
              </section>

              <section className="style-lab-panel rounded-[1.65rem] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <span className="rounded-full bg-primary/12 p-2 text-primary">
                    <LumaIcon icon={BubbleChatSparkFreeIcons} size={16} />
                  </span>
                  <div>
                    <div className="text-sm font-medium tracking-tight">Notes & Decisions</div>
                    <div className="text-xs text-muted-foreground">
                      Placeholder content with a stronger dashboard rhythm
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-dashed border-border/80 bg-background/50 px-4 py-5 text-sm text-muted-foreground">
                  Future sections stay compact and card-based instead of reading like a continuous rail.
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PrimitiveComparison({ theme }: { theme: PreviewTheme }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PreviewPanel
        label="Current primitives"
        caption="Dense controls, mono-heavy presentation, and flatter modal chrome."
        mode="before"
      >
        <div className={cn('legacy-preview-theme space-y-6 p-6', theme)}>
          <div className="flex flex-wrap gap-3">
            <LegacyButton variant="primary">Create Project</LegacyButton>
            <LegacyButton variant="secondary">Browse</LegacyButton>
            <LegacyButton variant="ghost">Cancel</LegacyButton>
            <LegacyButton variant="danger">Archive</LegacyButton>
          </div>

          <div className="grid gap-3">
            <LegacyInput placeholder="Project name" />
            <LegacyInput placeholder="/Users/you/projects/spectrum" />
          </div>

          <div className="relative min-h-[240px] overflow-hidden rounded-[26px] border border-border bg-bg p-4">
            <div className="absolute inset-0 bg-black/55" />
            <div className="relative mx-auto mt-6 w-full max-w-md rounded-lg border border-border bg-bg-raised shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="text-sm font-semibold text-text-primary">New Project</div>
                <button className="text-lg leading-none text-text-muted">×</button>
              </div>
              <div className="space-y-3 p-4">
                <LegacyInput placeholder="my-awesome-project" />
                <LegacyInput placeholder="/Users/you/projects/my-project" />
                <div className="flex justify-end gap-2 pt-2">
                  <LegacyButton variant="ghost">Cancel</LegacyButton>
                  <LegacyButton variant="primary">Create Project</LegacyButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PreviewPanel>

      <PreviewPanel
        label="Luma primitives"
        caption="Rounder controls, glassier surfaces, and a quieter neutral system with more breathing room."
      >
        <div className="space-y-6 p-6">
          <div className="flex flex-wrap gap-3">
            <Button>Create Project</Button>
            <Button variant="outline">Browse</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Archive</Button>
          </div>

          <div className="grid gap-3">
            <Input placeholder="Project name" />
            <Input placeholder="/Users/you/projects/spectrum" />
          </div>

          <div className="style-lab-panel relative min-h-[240px] overflow-hidden rounded-[28px] p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.82_0_0/0.16),transparent_42%)]" />
            <div className="style-lab-frost relative mx-auto mt-5 w-full max-w-md rounded-[2rem] border border-border/70 bg-popover/92 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.7)]">
              <div className="flex items-start justify-between gap-4 px-6 pt-6">
                <div>
                  <div className="text-base font-medium tracking-tight text-popover-foreground">
                    New Project
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Create a cockpit with a calmer macOS-like surface.
                  </div>
                </div>
                <Button variant="secondary" size="icon-sm">
                  <LumaIcon icon={ArrowRight01FreeIcons} size={14} className="rotate-45" />
                </Button>
              </div>
              <div className="space-y-3 px-6 py-5">
                <Input placeholder="my-awesome-project" />
                <Input placeholder="/Users/you/projects/spectrum" />
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost">Cancel</Button>
                  <Button>Create Project</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PreviewPanel>
    </div>
  )
}

export function StyleLabPage() {
  const [theme, setTheme] = useState<PreviewTheme>('dark')

  const previewThemeLabel = useMemo(
    () => (theme === 'dark' ? 'Dark preview enabled' : 'Light preview enabled'),
    [theme]
  )

  return (
    <div className={cn('style-lab-theme min-h-screen bg-background text-foreground font-sans', theme)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="style-lab-orb style-lab-orb-neutral" />
        <div className="style-lab-orb style-lab-orb-prism" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-8 px-6 py-8 lg:px-10">
        <Card className="style-lab-hero overflow-hidden">
          <CardContent className="relative p-8 lg:p-10">
            <div className="style-lab-beam absolute inset-x-0 top-0 h-32" />
            <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge>Style Lab</Badge>
                  <Badge variant="outline">shadcn luma</Badge>
                  <Badge variant="outline">Hugeicons</Badge>
                  <Badge variant="outline">Geist</Badge>
                  <Badge variant="outline">Neutral / Monochrome / Emerald</Badge>
                </div>

                <h1 className="max-w-3xl text-4xl font-medium tracking-tight text-foreground lg:text-5xl">
                  Spectrum UI overhaul preview
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  A dedicated before-and-after page for the sidebar, project page, and core primitives before the full migration touches the live shell.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-border/70 bg-background/72 px-4 py-2 text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {previewThemeLabel}
                </div>
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  onClick={() => setTheme('light')}
                >
                  Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  onClick={() => setTheme('dark')}
                >
                  Dark
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-5">
          <SectionLabel
            eyebrow="Primitives"
            title="Base controls and modal chrome"
            detail="This isolates the homegrown controls against the new shadcn Luma equivalents so spacing, roundness, and material changes are immediately visible."
          />
          <PrimitiveComparison theme={theme} />
        </section>

        <Separator />

        <section className="space-y-5">
          <SectionLabel
            eyebrow="Surface 01"
            title="Sidebar comparison"
            detail="The navigator stays focused on projects and settings, but picks up softer native-feeling materials, improved spacing, and subtle prism accents."
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <PreviewPanel
              label="Before"
              caption="Current project navigator density and action placement."
              mode="before"
            >
              <LegacySidebarPreview theme={theme} />
            </PreviewPanel>

            <PreviewPanel
              label="After"
              caption="Luma direction with macOS-like layering and understated color."
            >
              <div className="p-5">
                <LumaSidebarPreview />
              </div>
            </PreviewPanel>
          </div>
        </section>

        <Separator />

        <section className="space-y-5">
          <SectionLabel
            eyebrow="Surface 02"
            title="Project page comparison"
            detail="The detail rail shifts toward a stronger dashboard hierarchy while preserving Spectrum’s project-first identity and keeping the embedded panel model unchanged."
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <PreviewPanel
              label="Before"
              caption="Current detail rail with linear sections and low-contrast hierarchy."
              mode="before"
            >
              <LegacyProjectPagePreview theme={theme} />
            </PreviewPanel>

            <PreviewPanel
              label="After"
              caption="Card-grouped hierarchy, native-feeling materials, and restrained neutral emphasis."
            >
              <div className="p-5">
                <LumaProjectPagePreview />
              </div>
            </PreviewPanel>
          </div>
        </section>

        <Card>
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <span className="rounded-full bg-primary/12 p-2 text-primary">
                  <LumaIcon icon={DashboardSquare02FreeIcons} size={16} />
                </span>
                Review target for the next pass
              </div>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                If this direction is right, the next implementation pass can replace the live shared primitives, sidebar, project page, settings, and modals with these real shadcn-based surfaces while keeping embedded panels intact.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild>
                <a href="/">Return to app</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
