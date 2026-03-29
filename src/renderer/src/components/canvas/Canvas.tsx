import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useUiStore } from '@renderer/stores/ui.store'
import { useWorkspacesStore, type ActiveWorkspacePanel } from '@renderer/stores/workspaces.store'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { t3codeApi } from '@renderer/lib/ipc'
import { WorkspacePanel } from './WorkspacePanel'
import { NewCanvasItemMenu } from './NewCanvasItemMenu'
import { cn } from '@renderer/lib/cn'
import { nanoid } from 'nanoid'
import type { PanelType, Workspace } from '@shared/workspace.types'
import type { Project } from '@shared/project.types'

function isCentipedeProject(project: Project): boolean {
  const normalizedName = project.name.trim().toLowerCase()
  const normalizedRepoName = project.repoPath
    .split(/[\\/]/)
    .filter(Boolean)
    .at(-1)
    ?.trim()
    .toLowerCase() ?? ''
  return normalizedName === 'centipede' || normalizedRepoName === 'centipede'
}

function getWarmupPanelId(workspaces: Workspace[]): string | null {
  for (const workspace of workspaces) {
    const panel = workspace.layoutState.panels.find((entry) => entry.type === 't3code')
    if (panel) {
      return panel.id
    }
  }

  return null
}

function buildActivePanel(workspace: Workspace, cwd: string): ActiveWorkspacePanel {
  const panel = workspace.layoutState.panels[0] ?? {
    id: nanoid(),
    type: 'terminal' as const,
    title: 'Terminal'
  }

  return {
    panelId: panel.id,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    cwd,
    panelType: panel.type,
    panelTitle: panel.title
  }
}

export function Canvas() {
  const { activeProjectId } = useUiStore()
  const {
    workspaces,
    activePanels,
    focusedPanelId,
    loadWorkspaces,
    createWorkspace,
    setActivePanels,
    addActivePanel,
    insertPanelAfter,
    closeActivePanel,
    restorePanelsFromWorkspaces
  } = useWorkspacesStore()
  const { projects } = useProjectsStore()
  const didAutoOpenRef = useRef<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null
  const projectWorkspaces = activeProjectId
    ? workspaces.filter(
        (workspace) => workspace.projectId === activeProjectId && !workspace.archived
      )
    : []
  const panelsByWorkspace = useMemo(() => {
    const panelsById = new Map<string, ActiveWorkspacePanel[]>()

    for (const panel of activePanels) {
      const existing = panelsById.get(panel.workspaceId)
      if (existing) {
        existing.push(panel)
      } else {
        panelsById.set(panel.workspaceId, [panel])
      }
    }

    return projectWorkspaces
      .map((workspace) => ({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        panels: panelsById.get(workspace.id) ?? []
      }))
      .filter((workspace) => workspace.panels.length > 0)
  }, [activePanels, projectWorkspaces])

  // Load workspaces when project changes and restore saved panel state
  useEffect(() => {
    if (!activeProjectId) {
      setActivePanels([])
      didAutoOpenRef.current = null
      return
    }

    let cancelled = false

    loadWorkspaces(activeProjectId).then(() => {
      if (cancelled) return

      const { workspaces: loadedWorkspaces } = useWorkspacesStore.getState()
      const projectWs = loadedWorkspaces.filter((w) => w.projectId === activeProjectId)

      // Check if any workspace has saved panels to restore
      const hasSavedPanels = projectWs.some((w) => w.layoutState.panels.length > 0)

      if (hasSavedPanels && activeProject) {
        // Restore all panels from saved layout state
        didAutoOpenRef.current = activeProjectId
        restorePanelsFromWorkspaces(projectWs, activeProject.repoPath)
      } else if (projectWs.length > 0 && activeProject) {
        // Fallback: open the first workspace with a default panel
        didAutoOpenRef.current = activeProjectId
        setActivePanels([buildActivePanel(projectWs[0], activeProject.repoPath)])
      } else {
        setActivePanels([])
        didAutoOpenRef.current = null
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeProjectId, activeProject, loadWorkspaces])

  useEffect(() => {
    if (!activeProject || !isCentipedeProject(activeProject)) return

    const panelId = getWarmupPanelId(projectWorkspaces)
    if (!panelId) return

    let cancelled = false

    t3codeApi.start(panelId, activeProject.repoPath).catch(() => {
      if (cancelled) return
    })

    return () => {
      cancelled = true
      t3codeApi.stop(panelId).catch(() => {})
    }
  }, [activeProject, projectWorkspaces])

  const handleNewWorkspace = useCallback(async () => {
    if (!activeProjectId || !activeProject) return
    didAutoOpenRef.current = activeProjectId
    const nextWorkspaceNumber = projectWorkspaces.length + 1
    const ws = await createWorkspace({
      projectId: activeProjectId,
      name: `Workspace ${nextWorkspaceNumber}`,
      layoutState: {
        panels: [{ id: nanoid(), type: 't3code', title: 'T3Code' }],
        sizes: [100]
      }
    })
    addActivePanel(buildActivePanel(ws, activeProject.repoPath))
  }, [activeProjectId, activeProject, projectWorkspaces.length, createWorkspace])

  const handleAddPanel = useCallback(async (panelType: PanelType) => {
    if (!activeProjectId || !activeProject) return

    // Find the focused panel to determine target workspace and insertion position
    const focusedPanel = focusedPanelId
      ? activePanels.find((p) => p.panelId === focusedPanelId)
      : null

    let targetWorkspace = focusedPanel
      ? projectWorkspaces.find((ws) => ws.id === focusedPanel.workspaceId)
      : projectWorkspaces.find(
          (workspace) => workspace.id === activePanels.at(-1)?.workspaceId
        ) ?? projectWorkspaces[0]

    if (!targetWorkspace) {
      didAutoOpenRef.current = activeProjectId
      const nextWorkspaceNumber = projectWorkspaces.length + 1
      targetWorkspace = await createWorkspace({
        projectId: activeProjectId,
        name: `Workspace ${nextWorkspaceNumber}`,
        layoutState: {
          panels: [{ id: nanoid(), type: 't3code', title: 'T3Code' }],
          sizes: [100]
        }
      })
      addActivePanel(buildActivePanel(targetWorkspace, activeProject.repoPath))
    }

    const panelTitle =
      panelType === 't3code'
        ? 'T3Code'
        : panelType === 'browser'
          ? 'Browser'
          : panelType === 'chat'
            ? 'Chat'
            : 'Terminal'

    const newPanel: ActiveWorkspacePanel = {
      panelId: nanoid(),
      workspaceId: targetWorkspace.id,
      workspaceName: targetWorkspace.name,
      cwd: activeProject.repoPath,
      panelType,
      panelTitle
    }

    // Insert right after the focused panel, or append if no focus
    if (focusedPanel && focusedPanel.workspaceId === targetWorkspace.id) {
      insertPanelAfter(newPanel, focusedPanel.panelId)
    } else {
      addActivePanel(newPanel)
    }
  }, [activeProjectId, activeProject, activePanels, focusedPanelId, projectWorkspaces, createWorkspace, addActivePanel, insertPanelAfter])

  const handleClosePanel = useCallback((panelId: string) => {
    closeActivePanel(panelId)
  }, [closeActivePanel])

  const handleCanvasPointerDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (!(event.target instanceof HTMLElement)) return
    if (
      event.target.closest('[data-panel-root="true"]') ||
      event.target.closest('button, input, textarea, a, [role="button"]')
    ) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const startX = event.clientX
    const startY = event.clientY
    const startScrollLeft = canvas.scrollLeft
    const startScrollTop = canvas.scrollTop

    setIsPanning(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      canvas.scrollLeft = startScrollLeft - (moveEvent.clientX - startX)
      canvas.scrollTop = startScrollTop - (moveEvent.clientY - startY)
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  const panelOptions = useMemo(
    () => [
      {
        label: 'T3Code',
        description: 'Open a T3Code panel in the current workspace.',
        onSelect: () => {
          setShowCreateMenu(false)
          void handleAddPanel('t3code')
        }
      },
      {
        label: 'Terminal',
        description: 'Open a terminal panel in the current workspace.',
        onSelect: () => {
          setShowCreateMenu(false)
          void handleAddPanel('terminal')
        }
      },
      {
        label: 'Browser',
        description: 'Open a browser panel in the current workspace.',
        onSelect: () => {
          setShowCreateMenu(false)
          void handleAddPanel('browser')
        }
      }
    ],
    [handleAddPanel]
  )

  const workspaceOption = useMemo(
    () => ({
      label: 'Workspace',
      description: 'Create a new vertical workspace that starts with a T3Code panel.',
      onSelect: () => {
        setShowCreateMenu(false)
        void handleNewWorkspace()
      }
    }),
    [handleNewWorkspace]
  )

  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center canvas-grid">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-20">🐛</div>
          <p className="text-sm text-text-muted">
            Select a project or create a new one
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={canvasRef}
      data-canvas-scroll-root="true"
      onMouseDown={handleCanvasPointerDown}
      className={cn(
        'flex-1 canvas-grid relative overflow-auto',
        isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'
      )}
    >
      {/* Floating new workspace button */}
      <div className="sticky top-3 left-3 z-20 w-fit">
        <button
          onClick={() => setShowCreateMenu((open) => !open)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-raised border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 2V10M2 6H10"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
          New
        </button>
        <NewCanvasItemMenu
          open={showCreateMenu}
          onClose={() => setShowCreateMenu(false)}
          panelOptions={panelOptions}
          workspaceOption={workspaceOption}
        />
      </div>

      {/* Workspace panels */}
      <div
        className={cn(
          'min-h-full min-w-max p-6 flex flex-col gap-6',
          panelsByWorkspace.length === 1 && panelsByWorkspace[0]?.panels.length === 1
            ? 'justify-center'
            : 'justify-start'
        )}
      >
        {panelsByWorkspace.map((workspace) => (
          <div key={workspace.workspaceId} className="flex gap-6 items-start">
            {workspace.panels.map((panel) => (
              <WorkspacePanel
                key={panel.panelId}
                workspaceId={panel.workspaceId}
                workspaceName={panel.workspaceName}
                projectId={activeProjectId}
                cwd={panel.cwd}
                panelType={panel.panelType}
                panelTitle={panel.panelTitle}
                panelId={panel.panelId}
                onClose={() => handleClosePanel(panel.panelId)}
                initialWidth={panel.width}
                initialHeight={panel.height}
                initialUrl={panel.url}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Empty state when project is selected but no terminals */}
      {activePanels.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-xs text-text-muted opacity-50 mb-3">
              No open workspaces
            </p>
            <button
              onClick={() => setShowCreateMenu(true)}
              className="pointer-events-auto text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Open the create menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
