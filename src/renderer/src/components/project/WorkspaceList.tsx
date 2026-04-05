import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { nanoid } from 'nanoid'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { PanelGlyph } from '@renderer/components/shared/PanelIcons'
import { Button } from '@renderer/components/shared/Button'
import { Input } from '@renderer/components/shared/Input'
import { Button as UiButton } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { formatWorkspaceLastEditedAt } from '@renderer/lib/dates'
import { cn } from '@renderer/lib/cn'
import {
  getDominantNotificationKind,
  getThreadNotificationClasses,
  getUnreadThreadNotificationKind
} from '@renderer/lib/thread-notifications'
import type { PanelType, WorkspaceStatus } from '@shared/workspace.types'

const DEFAULT_T3CODE_PANEL = {
  title: 'T3Code',
  titleSource: 'default' as const,
  hasAutoRenamed: false
}

interface WorkspaceListProps {
  projectId: string
}

interface WorkspacePanelSummary {
  panelId: string
  panelType: PanelType
  panelTitle: string
  providerId?: string
}

interface WorkspaceEntry {
  workspaceId: string
  workspaceName: string
  status: WorkspaceStatus
  loaded: boolean
  archived: boolean
  panels: WorkspacePanelSummary[]
  notificationCount: number
  notificationKind: ReturnType<typeof getDominantNotificationKind>
  lastPanelEditedAt: string | null
}

function InfoTooltip({ copy }: { copy: string }) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Show section description"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-bg text-[11px] text-text-muted transition-colors hover:border-border hover:text-text-primary"
      >
        i
      </button>
      <div className="pointer-events-none absolute left-0 top-7 z-10 w-56 rounded-xl border border-border/70 bg-bg-raised px-3 py-2 text-[11px] leading-5 text-text-secondary opacity-0 shadow-xl shadow-black/20 transition-opacity group-hover:opacity-100">
        {copy}
      </div>
    </div>
  )
}

function ActionIconButton({
  label,
  onClick,
  children,
  className
}: {
  label: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
  className?: string
}) {
  return (
    <div className="group/tooltip relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-active hover:text-text-primary',
          className
        )}
      >
        {children}
      </button>
      <div className="pointer-events-none absolute left-1/2 top-8 z-20 -translate-x-1/2 rounded-lg border border-border/70 bg-bg-raised px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-text-secondary opacity-0 shadow-xl shadow-black/20 transition-opacity group-hover/tooltip:opacity-100">
        {label}
      </div>
    </div>
  )
}

export function WorkspaceList({ projectId }: WorkspaceListProps) {
  const {
    workspaces,
    activePanels,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    unloadWorkspace,
    archiveWorkspace,
    unarchiveWorkspace,
    reopenWorkspace,
    addActivePanel,
    requestClosePanel,
    focusWorkspace,
    focusedPanelId,
    setFocusedPanel
  } = useWorkspacesStore()
  const activeWorkspaceId = usePanelRuntimeStore((state) => state.activeWorkspaceId)
  const panelRuntimeById = usePanelRuntimeStore((state) => state.panelRuntimeById)
  const projects = useProjectsStore((state) => state.projects)
  const activeProjectId = useUiStore((state) => state.activeProjectId)
  const archivedTimestampFormat = useUiStore((state) => state.archivedTimestampFormat)
  const repoPath = projects.find((project) => project.id === activeProjectId)?.repoPath ?? ''

  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([])
  const [addPanelMenuWorkspaceId, setAddPanelMenuWorkspaceId] = useState<string | null>(null)
  const [workspaceMenuId, setWorkspaceMenuId] = useState<string | null>(null)
  const [timestampNow, setTimestampNow] = useState(() => Date.now())
  const isCommitting = useRef(false)

  useEffect(() => {
    setTimestampNow(Date.now())
    const timer = window.setInterval(() => {
      setTimestampNow(Date.now())
    }, 60_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const activePanelsByWorkspace = useMemo(() => {
    return activePanels.reduce((map, panel) => {
      const existing = map.get(panel.workspaceId) ?? []
      existing.push(panel)
      map.set(panel.workspaceId, existing)
      return map
    }, new Map<string, typeof activePanels>())
  }, [activePanels])

  const workspaceEntries = useMemo<WorkspaceEntry[]>(() => {
    return workspaces
      .filter((workspace) => workspace.projectId === projectId)
      .map((workspace) => {
        const loadedPanels = activePanelsByWorkspace.get(workspace.id) ?? []
        const loaded = loadedPanels.length > 0
        const panels = loaded
          ? loadedPanels.map((panel) => ({
              panelId: panel.panelId,
              panelType: panel.panelType,
              panelTitle: panel.panelTitle,
              providerId: panel.providerId
            }))
          : workspace.layoutState.panels.map((panel) => ({
              panelId: panel.id,
              panelType: panel.type,
              panelTitle: panel.title,
              providerId: panel.providerId
            }))
        const notificationKinds = loadedPanels.map((panel) =>
          getUnreadThreadNotificationKind(panelRuntimeById[panel.panelId])
        )

        return {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          status: workspace.status,
          loaded,
          archived: workspace.archived,
          panels,
          notificationCount: notificationKinds.filter(Boolean).length,
          notificationKind: getDominantNotificationKind(notificationKinds),
          lastPanelEditedAt: workspace.lastPanelEditedAt
        }
      })
  }, [activePanelsByWorkspace, panelRuntimeById, projectId, workspaces])

  useEffect(() => {
    if (!workspaceMenuId) {
      return
    }

    const handleClick = () => {
      setWorkspaceMenuId(null)
    }

    window.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('click', handleClick)
    }
  }, [workspaceMenuId])

  const activeEntries = workspaceEntries.filter((entry) => entry.status === 'active')
  const savedEntries = workspaceEntries.filter((entry) => entry.status === 'saved')
  const archivedEntries = workspaceEntries.filter((entry) => entry.archived)

  const commitRename = useCallback(
    async (workspaceId: string, currentName: string) => {
      if (isCommitting.current) {
        return
      }

      isCommitting.current = true
      const nextName = draftName.trim()

      if (!nextName || nextName === currentName) {
        setEditingWorkspaceId(null)
        setDraftName('')
        isCommitting.current = false
        return
      }

      try {
        await updateWorkspace({ id: workspaceId, name: nextName, nameSource: 'user' })
      } catch (error) {
        console.error('[WorkspaceList] Failed to rename workspace:', error)
      } finally {
        setEditingWorkspaceId(null)
        setDraftName('')
        isCommitting.current = false
      }
    },
    [draftName, updateWorkspace]
  )

  const cancelRename = useCallback(() => {
    setEditingWorkspaceId(null)
    setDraftName('')
  }, [])

  const beginRename = useCallback((workspaceId: string, currentName: string) => {
    setSelectedWorkspaceId(workspaceId)
    setEditingWorkspaceId(workspaceId)
    setDraftName(currentName)
  }, [])

  const handleCreate = async () => {
    const nextWorkspaceNumber = workspaceEntries.filter((entry) => !entry.archived).length + 1
    const workspace = await createWorkspace({
      projectId,
      name: `Workspace ${nextWorkspaceNumber}`,
      layoutState: {
        panels: [{ id: nanoid(), type: 't3code', ...DEFAULT_T3CODE_PANEL }],
        sizes: [100]
      }
    })
    const panel = workspace.layoutState.panels[0]
    if (!panel) {
      return
    }

    addActivePanel({
      panelId: panel.id,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      cwd: repoPath,
      panelType: panel.type,
      panelTitle: panel.title,
      titleSource: panel.titleSource,
      hasAutoRenamed: panel.hasAutoRenamed,
      providerId: panel.providerId,
      t3ProjectId: panel.t3ProjectId,
      t3ThreadId: panel.t3ThreadId
    })
    setExpandedWorkspaceIds((current) =>
      current.includes(workspace.id) ? current : [...current, workspace.id]
    )
    setSelectedWorkspaceId(workspace.id)
  }

  const handleAddPanel = (workspaceId: string, panelType: PanelType) => {
    const workspace = activeEntries.find((entry) => entry.workspaceId === workspaceId)
    if (!workspace) {
      return
    }

    const panelTitle =
      panelType === 't3code'
        ? 'T3Code'
        : panelType === 'browser'
          ? 'Browser'
          : panelType === 'file'
            ? 'Files'
            : 'Terminal'

    addActivePanel({
      panelId: nanoid(),
      workspaceId,
      workspaceName: workspace.workspaceName,
      cwd: repoPath,
      panelType,
      panelTitle,
      ...(panelType === 't3code'
        ? { titleSource: 'default' as const, hasAutoRenamed: false }
        : {})
    })
    setAddPanelMenuWorkspaceId(null)
  }

  const handleUnload = async (workspaceId: string) => {
    if (editingWorkspaceId === workspaceId) {
      cancelRename()
    }

    await unloadWorkspace(workspaceId)
    setSelectedWorkspaceId(workspaceId)
    setAddPanelMenuWorkspaceId(null)
    setWorkspaceMenuId(null)
  }

  const handleArchive = async (workspaceId: string) => {
    if (editingWorkspaceId === workspaceId) {
      cancelRename()
    }

    await archiveWorkspace(workspaceId)
    setSelectedWorkspaceId(null)
    setAddPanelMenuWorkspaceId(null)
    setWorkspaceMenuId(null)
  }

  const handleDelete = async (workspaceId: string, workspaceName: string) => {
    if (editingWorkspaceId === workspaceId) {
      cancelRename()
    }

    const confirmed = window.confirm(`Delete "${workspaceName}" permanently?`)
    if (!confirmed) {
      return
    }

    await deleteWorkspace(workspaceId)
    setSelectedWorkspaceId(null)
    setAddPanelMenuWorkspaceId(null)
    setWorkspaceMenuId(null)
  }

  const handleLoad = async (workspaceId: string) => {
    await reopenWorkspace(workspaceId, repoPath)
    setExpandedWorkspaceIds((current) =>
      current.includes(workspaceId) ? current : [...current, workspaceId]
    )
    setSelectedWorkspaceId(workspaceId)
  }

  const handleRestoreToSaved = async (workspaceId: string) => {
    const workspace = await unarchiveWorkspace(workspaceId)
    if (!workspace) {
      return
    }

    await unloadWorkspace(workspace.id)
    setSelectedWorkspaceId(workspace.id)
    setWorkspaceMenuId(null)
  }

  const handleRestoreAndLoad = async (workspaceId: string) => {
    const workspace = await unarchiveWorkspace(workspaceId)
    if (!workspace) {
      return
    }

    await reopenWorkspace(workspace.id, repoPath)
    setSelectedWorkspaceId(workspace.id)
    setWorkspaceMenuId(null)
  }

  const handlePanelClick = (workspaceId: string, panelId: string) => {
    setSelectedWorkspaceId(workspaceId)
    setFocusedPanel(panelId)
  }

  const handleClosePanel = (panelId: string, event: MouseEvent) => {
    event.stopPropagation()
    void requestClosePanel(panelId)
  }

  const toggleWorkspacePanels = (workspaceId: string) => {
    setExpandedWorkspaceIds((current) =>
      current.includes(workspaceId)
        ? current.filter((id) => id !== workspaceId)
        : [...current, workspaceId]
    )
  }

  const toggleWorkspaceMenu = (workspaceId: string) => {
    setWorkspaceMenuId((current) => (current === workspaceId ? null : workspaceId))
  }

  const renderWorkspaceTitle = (entry: WorkspaceEntry) => {
    if (editingWorkspaceId === entry.workspaceId) {
      return (
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => void commitRename(entry.workspaceId, entry.workspaceName)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              cancelRename()
            }
          }}
          autoFocus
          className="h-8 flex-1"
        />
      )
    }

    return (
      <button
        type="button"
        onDoubleClick={(event) => {
          event.stopPropagation()
          beginRename(entry.workspaceId, entry.workspaceName)
        }}
        className="min-w-0 max-w-[240px] flex-none text-left text-sm font-medium text-text-primary"
        title="Double-click to rename workspace"
      >
        <span className="truncate block">{entry.workspaceName}</span>
      </button>
    )
  }

  const renderPanelPreview = (panels: WorkspacePanelSummary[]) => {
    if (panels.length === 0) {
      return null
    }

    return (
      <div className="ml-1.5 flex items-center">
        {panels.slice(0, 3).map((panel, index) => (
          <span
            key={panel.panelId}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border border-border bg-bg-raised text-text-secondary',
              index === 0 ? '' : '-ml-1.5'
            )}
            title={panel.panelTitle}
          >
            <PanelGlyph panelType={panel.panelType} providerId={panel.providerId} className="h-3 w-3" />
          </span>
        ))}
        {panels.length > 3 ? (
          <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-bg px-2 text-[11px] text-text-muted">
            +{panels.length - 3}
          </span>
        ) : null}
      </div>
    )
  }

  const renderWorkspaceQuickAction = (
    entry: WorkspaceEntry,
    action: 'load' | 'unload',
    className?: string
  ) => {
    const isActive = activeWorkspaceId === entry.workspaceId
    const isSelected = (selectedWorkspaceId ?? activeWorkspaceId) === entry.workspaceId
    const isHighlighted = isActive || isSelected

    return (
      <ActionIconButton
        label={action === 'load' ? 'Load' : 'Unload'}
        onClick={(event) => {
          event.stopPropagation()
          if (action === 'load') {
            void handleLoad(entry.workspaceId)
            return
          }

          void handleUnload(entry.workspaceId)
        }}
        className={cn(
          'opacity-0 transition-all group-hover:opacity-100',
          action === 'unload' ? 'mt-2' : '',
          isHighlighted && 'opacity-100',
          isHighlighted
            ? 'text-white/72 hover:bg-white/12 hover:text-white'
            : action === 'load' && 'text-accent hover:bg-accent hover:text-white',
          className
        )}
      >
        {action === 'unload' ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M6 2V7.5M6 7.5L3.75 5.25M6 7.5L8.25 5.25M2.5 9.5H9.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M6 10V4.5M6 4.5L3.75 6.75M6 4.5L8.25 6.75M2.5 2.5H9.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </ActionIconButton>
    )
  }

  const renderSectionHeader = (title: string, copy: string) => (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</h3>
        <InfoTooltip copy={copy} />
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Workspaces
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              Each project keeps its own working set, layout, and panel stack.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            + Add
          </Button>
        </div>
      </div>

      <section className="pb-5 border-b border-border-subtle/70">
        {renderSectionHeader('Active Workspaces', 'Loaded into the canvas and restored when the project opens.')}

        {activeEntries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-bg/40 px-3 py-3 text-xs text-text-muted">
            No active workspaces.
          </p>
        ) : (
          <div className="space-y-2">
            {activeEntries.map((entry) => {
              const isActive = activeWorkspaceId === entry.workspaceId
              const isSelected = (selectedWorkspaceId ?? activeWorkspaceId) === entry.workspaceId
              const isHighlighted = isActive || isSelected
              const isExpanded = expandedWorkspaceIds.includes(entry.workspaceId)

              return (
                <div
                  key={entry.workspaceId}
                  className={cn(
                    'project-workspace-card rounded-[1rem] transition-colors',
                    isHighlighted
                      ? 'project-workspace-card-selected'
                      : 'border-border-subtle bg-bg-raised/40 hover:border-border hover:bg-bg-hover/70'
                  )}
                >
                  <div
                    className="group cursor-pointer px-3 py-3"
                    onClick={() => {
                      setSelectedWorkspaceId(entry.workspaceId)
                      focusWorkspace(entry.workspaceId)
                      toggleWorkspacePanels(entry.workspaceId)
                      setAddPanelMenuWorkspaceId(null)
                      setWorkspaceMenuId(null)
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {renderWorkspaceTitle(entry)}
                          {renderPanelPreview(entry.panels)}
                          {entry.notificationCount > 0 ? (
                            <span
                              className={cn(
                                'inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                getThreadNotificationClasses(entry.notificationKind).badge
                              )}
                            >
                              {entry.notificationCount}
                            </span>
                          ) : null}
                        </div>
                        <div className={cn(
                          'mt-2 flex items-center gap-2 text-[11px]',
                          isHighlighted ? 'text-white/72' : 'text-text-muted'
                        )}>
                          <span>
                            Last edited {formatWorkspaceLastEditedAt(entry.lastPanelEditedAt, archivedTimestampFormat, timestampNow)}
                          </span>
                        </div>
                      </div>
                      <div className="relative flex flex-col items-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleWorkspaceMenu(entry.workspaceId)
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          className={cn(
                            'rounded-md px-2 py-1 text-xs transition-colors',
                            isHighlighted
                              ? 'text-white/72 hover:bg-white/12 hover:text-white'
                              : 'text-text-muted hover:bg-bg-active hover:text-text-primary'
                          )}
                          aria-label="Workspace actions"
                        >
                          •••
                        </button>
                        {workspaceMenuId === entry.workspaceId ? (
                          <div
                            className="absolute right-0 top-8 z-20 min-w-40 rounded-xl border border-border/70 bg-bg-raised p-1 shadow-xl shadow-black/20"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                beginRename(entry.workspaceId, entry.workspaceName)
                                setWorkspaceMenuId(null)
                              }}
                              className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(entry.workspaceId, entry.workspaceName)}
                              className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                        <div
                          className={cn(
                            'mt-2 flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100',
                            isHighlighted && 'opacity-100'
                          )}
                        >
                          {renderWorkspaceQuickAction(entry, 'unload')}
                          <ActionIconButton
                            label="Add Panel"
                            onClick={(event) => {
                              event.stopPropagation()
                              setAddPanelMenuWorkspaceId(
                                addPanelMenuWorkspaceId === entry.workspaceId ? null : entry.workspaceId
                              )
                            }}
                            className={cn(
                              'opacity-0 transition-all group-hover:opacity-100',
                              isHighlighted && 'opacity-100'
                            )}
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                              <path
                                d="M6 2.25V9.75M2.25 6H9.75"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                              />
                            </svg>
                          </ActionIconButton>
                        </div>
                      </div>
                    </div>
                  </div>

                  {addPanelMenuWorkspaceId === entry.workspaceId ? (
                    <div className="border-t border-white/10 px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {(['t3code', 'terminal', 'browser', 'file'] as const).map((type) => (
                          <Button
                            key={type}
                            variant="secondary"
                            size="sm"
                            onClick={() => handleAddPanel(entry.workspaceId, type)}
                          >
                            {type === 't3code'
                              ? 'T3Code'
                              : type === 'browser'
                                ? 'Browser'
                                : type === 'file'
                                  ? 'File Editor'
                                  : 'Terminal'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {isExpanded ? (
                    <div className={cn('px-3 py-2', isHighlighted ? 'border-t border-white/10' : 'border-t border-border-subtle')}>
                      <div className="space-y-1">
                        {entry.panels.map((panel) => {
                          const notificationKind = getUnreadThreadNotificationKind(
                            panelRuntimeById[panel.panelId]
                          )

                          return (
                            <div
                              key={panel.panelId}
                              onClick={() => handlePanelClick(entry.workspaceId, panel.panelId)}
                              className={cn(
                                'group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors',
                                focusedPanelId === panel.panelId
                                  ? isHighlighted
                                    ? 'bg-black/22 text-white'
                                    : 'bg-bg-active text-text-primary'
                                  : isHighlighted
                                    ? 'bg-black/14 text-white/78 hover:bg-black/22 hover:text-white'
                                    : 'bg-bg/40 text-text-secondary hover:bg-bg-active hover:text-text-primary'
                              )}
                            >
                              <span className={cn(
                                'flex h-5 w-5 items-center justify-center rounded-full border',
                                isHighlighted
                                  ? 'border-white/20 bg-white/12 text-white/78'
                                  : 'border-border bg-bg-raised text-text-secondary'
                              )}>
                                <PanelGlyph
                                  panelType={panel.panelType}
                                  providerId={panel.providerId}
                                  className="h-3 w-3"
                                />
                              </span>
                              <span className={cn('uppercase tracking-wide', isHighlighted ? 'text-white/54' : 'text-text-muted')}>{panel.panelType}</span>
                              <span className={cn('flex-1 truncate', isHighlighted ? 'text-white' : 'text-text-primary')}>{panel.panelTitle}</span>
                              {notificationKind ? (
                                <span
                                  className={cn(
                                    'h-2.5 w-2.5 rounded-full ring-4',
                                    getThreadNotificationClasses(notificationKind).dot
                                  )}
                                />
                              ) : null}
                              <button
                                type="button"
                                title="Close panel"
                                aria-label="Close panel"
                                onClick={(event) => handleClosePanel(panel.panelId, event)}
                                className={cn(
                                  'flex h-5 w-5 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100',
                                  isHighlighted
                                    ? 'text-white/58 hover:bg-white/14 hover:text-white'
                                    : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
                                )}
                              >
                                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
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
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="py-5 border-b border-border-subtle/70">
        {renderSectionHeader('Saved Workspaces', 'Persisted, searchable, and ready to load back into the canvas.')}

        {savedEntries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/60 bg-bg/40 px-3 py-3 text-xs text-text-muted">
            No saved workspaces.
          </p>
        ) : (
          <div className="space-y-2">
            {savedEntries.map((entry) => (
              <div
                key={entry.workspaceId}
                className={cn(
                  'group rounded-[1rem] border border-border-subtle bg-bg-raised/30 px-3 py-3 transition-colors',
                  selectedWorkspaceId === entry.workspaceId && 'border-[var(--project-border)] bg-bg-hover'
                )}
                onClick={() => setSelectedWorkspaceId(entry.workspaceId)}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
                    <div className="min-w-0 shrink-0">
                      {renderWorkspaceTitle(entry)}
                    </div>
                    {renderPanelPreview(entry.panels)}
                    <span className="text-[11px] text-text-muted/70">•</span>
                    <div className="min-w-0 flex-1 text-[11px] text-text-muted">
                      <span className="block truncate">
                        Last edited {formatWorkspaceLastEditedAt(entry.lastPanelEditedAt, archivedTimestampFormat, timestampNow)}
                      </span>
                    </div>
                  </div>
                  <div className="relative flex items-center gap-1 self-center">
                    {renderWorkspaceQuickAction(entry, 'load', 'group-hover:opacity-100')}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleWorkspaceMenu(entry.workspaceId)
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      className="rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-bg-active hover:text-text-primary"
                      aria-label="Workspace actions"
                    >
                      •••
                    </button>
                    {workspaceMenuId === entry.workspaceId ? (
                      <div
                        className="absolute right-0 top-8 z-20 min-w-40 rounded-lg border border-border bg-bg-raised p-1 shadow-lg"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            beginRename(entry.workspaceId, entry.workspaceName)
                            setWorkspaceMenuId(null)
                          }}
                          className="w-full rounded px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleArchive(entry.workspaceId)}
                          className="w-full rounded px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(entry.workspaceId, entry.workspaceName)}
                          className="w-full rounded px-3 py-1.5 text-left text-xs text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="pt-5">
        {renderSectionHeader('Archived Workspaces', 'History shelf. Kept out of the main loop, but still recoverable.')}

        {archivedEntries.length === 0 ? (
          <p className="px-1 py-1 text-xs text-text-muted">
            No archived workspaces.
          </p>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <UiButton
                variant="link"
                size="sm"
                className="h-auto px-1 py-0 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                View archived workspaces ({archivedEntries.length})
              </UiButton>
            </DialogTrigger>
            <DialogContent className="max-w-2xl gap-4">
              <DialogHeader className="pr-10">
                <DialogTitle>Archived Workspaces</DialogTitle>
                <DialogDescription>
                  Archived workspaces stay out of the main project page, but you can restore them at any time.
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[min(65vh,44rem)] space-y-2 overflow-y-auto pr-1">
                {archivedEntries.map((entry) => (
                  <div
                    key={entry.workspaceId}
                    className="rounded-[1.15rem] border border-border/65 bg-bg-raised/22 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {entry.workspaceName}
                          </div>
                          {renderPanelPreview(entry.panels)}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                          <span>
                            Last edited {formatWorkspaceLastEditedAt(entry.lastPanelEditedAt, archivedTimestampFormat, timestampNow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRestoreToSaved(entry.workspaceId)}
                      >
                        Restore to Saved
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRestoreAndLoad(entry.workspaceId)}
                      >
                        Restore and Load
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </section>
    </div>
  )
}
