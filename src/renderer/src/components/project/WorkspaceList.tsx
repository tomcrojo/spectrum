import { useCallback, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { ProgressIcon } from '@renderer/components/shared/ProgressIcon'
import { Button } from '@renderer/components/shared/Button'
import { Input } from '@renderer/components/shared/Input'
import { formatWorkspaceLastEditedAt } from '@renderer/lib/dates'
import { t3codeApi } from '@renderer/lib/ipc'

interface WorkspaceListProps {
  projectId: string
}

export function WorkspaceList({ projectId }: WorkspaceListProps) {
  const {
    workspaces,
    activePanels,
    loadWorkspaces,
    createWorkspace,
    updateWorkspace,
    archiveWorkspace,
    unarchiveWorkspace,
    reopenWorkspace,
    addActivePanel,
    focusWorkspace,
    focusedPanelId,
    setFocusedPanel,
    updateWorkspaceLastPanelEditedAt
  } = useWorkspacesStore()
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectId = useUiStore((s) => s.activeProjectId)
  const archivedTimestampFormat = useUiStore((s) => s.archivedTimestampFormat)
  const repoPath =
    projects.find((p) => p.id === activeProjectId)?.repoPath ?? ''

  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [archivedExpanded, setArchivedExpanded] = useState(false)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([])
  const [timestampNow, setTimestampNow] = useState(() => Date.now())
  /** Guard against double-commit from blur + unmount */
  const isCommitting = useRef(false)
  const workspaceClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedT3CodePanelIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    loadWorkspaces(projectId)
    hydratedT3CodePanelIdsRef.current = new Set()
  }, [projectId, loadWorkspaces])

  useEffect(() => {
    return () => {
      if (workspaceClickTimeoutRef.current) {
        clearTimeout(workspaceClickTimeoutRef.current)
      }
    }
  }, [])

  const panelsByWorkspace = activePanels.reduce((map, panel) => {
    const existingPanels = map.get(panel.workspaceId) ?? []
    existingPanels.push(panel)
    map.set(panel.workspaceId, existingPanels)
    return map
  }, new Map<string, typeof activePanels>())
  const activeWorkspaces = workspaces
    .filter((workspace) => !workspace.archived)
    .map((workspace) => ({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      panels:
        panelsByWorkspace.get(workspace.id) ??
        workspace.layoutState.panels.map((panel) => ({
          panelId: panel.id,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          cwd: repoPath,
          panelType: panel.type,
          panelTitle: panel.title,
          url: panel.url,
          width: panel.width,
          height: panel.height
        }))
    }))
  const archivedWorkspaces = workspaces.filter((workspace) => workspace.archived)

  useEffect(() => {
    if (
      archivedTimestampFormat !== 'relative' ||
      !archivedExpanded ||
      archivedWorkspaces.length === 0
    ) {
      return
    }

    setTimestampNow(Date.now())
    const timer = window.setInterval(() => {
      setTimestampNow(Date.now())
    }, 60_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [archivedExpanded, archivedTimestampFormat, archivedWorkspaces.length])

  useEffect(() => {
    if (!repoPath) {
      return
    }

    const t3CodePanels = workspaces.flatMap((workspace) =>
      workspace.layoutState.panels
        .filter((panel) => panel.type === 't3code')
        .map((panel) => ({
          workspaceId: workspace.id,
          panelId: panel.id
        }))
        .filter(({ panelId }) => !hydratedT3CodePanelIdsRef.current.has(panelId))
    )

    if (t3CodePanels.length === 0) {
      return
    }

    for (const { panelId } of t3CodePanels) {
      hydratedT3CodePanelIdsRef.current.add(panelId)
    }

    let cancelled = false

    void Promise.allSettled(
      t3CodePanels.map(async ({ workspaceId, panelId }) => {
        const threadInfo = await t3codeApi.getThreadInfo(panelId, repoPath)
        if (cancelled || !threadInfo.lastUserMessageAt) {
          return
        }

        await updateWorkspaceLastPanelEditedAt(workspaceId, threadInfo.lastUserMessageAt)
      })
    )

    return () => {
      cancelled = true
    }
  }, [repoPath, updateWorkspaceLastPanelEditedAt, workspaces])

  const commitRename = useCallback(
    async (workspaceId: string, currentName: string) => {
      // Prevent double-commit (blur can fire when input unmounts)
      if (isCommitting.current) return
      isCommitting.current = true

      const nextName = draftName.trim()

      if (!nextName || nextName === currentName) {
        setEditingWorkspaceId(null)
        setDraftName('')
        isCommitting.current = false
        return
      }

      try {
        // Persist first, then clear editing state so the span shows the new name
        await updateWorkspace({ id: workspaceId, name: nextName })
      } catch (err) {
        console.error('[WorkspaceList] Failed to rename workspace:', err)
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

  const beginRename = (workspaceId: string, currentName: string) => {
    setSelectedWorkspaceId(workspaceId)
    setEditingWorkspaceId(workspaceId)
    setDraftName(currentName)
  }

  const clearPendingWorkspaceClick = () => {
    if (workspaceClickTimeoutRef.current) {
      clearTimeout(workspaceClickTimeoutRef.current)
      workspaceClickTimeoutRef.current = null
    }
  }

  const focusSelectedWorkspace = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId)
    focusWorkspace(workspaceId)
  }

  const handleWorkspaceClick = (workspaceId: string) => {
    if (editingWorkspaceId) return

    clearPendingWorkspaceClick()
    workspaceClickTimeoutRef.current = setTimeout(() => {
      focusSelectedWorkspace(workspaceId)
      workspaceClickTimeoutRef.current = null
    }, 180)
  }

  const handleWorkspaceRename = (workspaceId: string, workspaceName: string) => {
    clearPendingWorkspaceClick()
    beginRename(workspaceId, workspaceName)
  }

  const handlePanelClick = (workspaceId: string, panelId: string) => {
    clearPendingWorkspaceClick()
    setSelectedWorkspaceId(workspaceId)
    setFocusedPanel(panelId)
  }

  const handleCreate = async () => {
    const nextWorkspaceNumber = workspaces.filter((workspace) => !workspace.archived).length + 1
    const workspace = await createWorkspace({
      projectId,
      name: `Workspace ${nextWorkspaceNumber}`,
      layoutState: {
        panels: [{ id: nanoid(), type: 't3code', title: 'T3Code' }],
        sizes: [100]
      }
    })
    const panel = workspace.layoutState.panels[0]
    if (!panel) return

    addActivePanel({
      panelId: panel.id,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      cwd: repoPath,
      panelType: panel.type,
      panelTitle: panel.title
    })
  }

  const handleArchive = async (workspaceId: string) => {
    if (editingWorkspaceId === workspaceId) {
      cancelRename()
    }
    if (selectedWorkspaceId === workspaceId) {
      setSelectedWorkspaceId(null)
    }
    await archiveWorkspace(workspaceId)
  }

  const handleRestore = async (workspaceId: string) => {
    const workspace = await unarchiveWorkspace(workspaceId)
    if (!workspace) return
    reopenWorkspace(workspace.id, repoPath)
  }

  const handleReopen = (workspaceId: string) => {
    reopenWorkspace(workspaceId, repoPath)
    focusSelectedWorkspace(workspaceId)
  }

  const toggleWorkspacePanels = (workspaceId: string) => {
    setExpandedWorkspaceIds((current) =>
      current.includes(workspaceId)
        ? current.filter((id) => id !== workspaceId)
        : [...current, workspaceId]
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Active Workspaces
        </h3>
        <Button variant="ghost" size="sm" onClick={handleCreate}>
          + Add
        </Button>
      </div>

      {activeWorkspaces.length === 0 ? (
        <p className="text-xs text-text-muted py-2">
          No active workspaces. Create one to start working.
        </p>
      ) : null}

      {activeWorkspaces.length > 0 ? (
        <div className="space-y-1">
          {activeWorkspaces.map((workspace) => (
            <div
              key={workspace.workspaceId}
              onClick={() => handleWorkspaceClick(workspace.workspaceId)}
              className={`group rounded transition-colors cursor-pointer ${
                selectedWorkspaceId === workspace.workspaceId
                  ? 'bg-bg-hover'
                  : 'hover:bg-bg-hover'
              }`}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <ProgressIcon progress={0} size={12} />
                {editingWorkspaceId === workspace.workspaceId ? (
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => void commitRename(workspace.workspaceId, workspace.workspaceName)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        // Commit via blur handler (blur() fires onBlur synchronously)
                        event.currentTarget.blur()
                      } else if (event.key === 'Escape') {
                        cancelRename()
                      }
                    }}
                    autoFocus
                    className="h-8 flex-1"
                  />
                ) : (
                  <span
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      handleWorkspaceRename(workspace.workspaceId, workspace.workspaceName)
                    }}
                    className="text-sm text-text-primary flex-1 rounded px-1 py-0.5"
                    title="Double-click to rename workspace"
                  >
                    {workspace.workspaceName}
                  </span>
                )}
                {workspace.panels.length > 0 ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleWorkspacePanels(workspace.workspaceId)
                    }}
                    className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-active transition-colors"
                  >
                    <span>
                      {workspace.panels.length} {workspace.panels.length === 1 ? 'panel' : 'panels'}
                    </span>
                    <svg
                      className={`h-3 w-3 transition-transform ${
                        expandedWorkspaceIds.includes(workspace.workspaceId) ? 'rotate-90' : ''
                      }`}
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M4.5 3L7.5 6L4.5 9"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleReopen(workspace.workspaceId)
                    }}
                    className="rounded px-1.5 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-active transition-colors"
                  >
                    Reopen
                  </button>
                )}
                <button
                  type="button"
                  title="Archive workspace"
                  aria-label="Archive workspace"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleArchive(workspace.workspaceId)
                  }}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-all hover:bg-bg-active hover:text-text-primary ${
                    selectedWorkspaceId === workspace.workspaceId ||
                    editingWorkspaceId === workspace.workspaceId
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2.5 4.25H11.5V11C11.5 11.5523 11.0523 12 10.5 12H3.5C2.94772 12 2.5 11.5523 2.5 11V4.25Z"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinejoin="round"
                    />
                    <path
                      d="M1.75 2.75H12.25V4.25H1.75V2.75Z"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinejoin="round"
                    />
                    <path
                      d="M5 6.25L7 8.25L9 6.25"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              {expandedWorkspaceIds.includes(workspace.workspaceId) ? (
                <div className="border-t border-border-subtle px-6 py-2">
                  <div className="space-y-1">
                    {workspace.panels.map((panel) => (
                      <div
                        key={panel.panelId}
                        onClick={(event) => {
                          event.stopPropagation()
                          handlePanelClick(workspace.workspaceId, panel.panelId)
                        }}
                        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${
                          focusedPanelId === panel.panelId
                            ? 'bg-bg-active text-text-primary'
                            : 'bg-bg/40 text-text-secondary hover:bg-bg-active hover:text-text-primary'
                        }`}
                      >
                        <span className="uppercase tracking-wide text-text-muted">
                          {panel.panelType}
                        </span>
                        <span className="text-text-primary truncate">{panel.panelTitle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button
            type="button"
            onClick={() => setArchivedExpanded((value) => !value)}
            className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors"
          >
            <svg
              className={`h-3 w-3 transition-transform ${
                archivedExpanded ? 'rotate-90' : ''
              }`}
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M4.5 3L7.5 6L4.5 9"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Archived Workspaces</span>
          </button>
          <span className="text-[11px] text-text-muted">
            {archivedWorkspaces.length}
          </span>
        </div>

        {archivedExpanded && archivedWorkspaces.length === 0 ? (
          <p className="text-xs text-text-muted py-2">
            No archived workspaces yet.
          </p>
        ) : null}

        {archivedExpanded && archivedWorkspaces.length > 0 ? (
          <div className="space-y-1">
            {archivedWorkspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-raised/50"
              >
                <ProgressIcon progress={0} size={12} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-text-primary truncate">{workspace.name}</div>
                  <div
                    className="text-xs text-text-muted"
                    title={`Last edited ${formatWorkspaceLastEditedAt(workspace.lastPanelEditedAt, 'full')}`}
                  >
                    {workspace.layoutState.panels.length}{' '}
                    {workspace.layoutState.panels.length === 1 ? 'saved panel' : 'saved panels'}
                    {' · '}
                    Last edited{' '}
                    {formatWorkspaceLastEditedAt(
                      workspace.lastPanelEditedAt,
                      archivedTimestampFormat,
                      timestampNow
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void handleRestore(workspace.id)}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
