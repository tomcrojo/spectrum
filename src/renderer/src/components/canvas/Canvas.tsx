import { useEffect, useCallback, useState, useRef } from 'react'
import { useUiStore } from '@renderer/stores/ui.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { WorkspacePanel } from './WorkspacePanel'
import { nanoid } from 'nanoid'

interface ActiveTerminal {
  terminalId: string
  workspaceId: string
  workspaceName: string
  cwd: string
}

export function Canvas() {
  const { activeProjectId } = useUiStore()
  const { workspaces, loadWorkspaces, createWorkspace } = useWorkspacesStore()
  const { projects } = useProjectsStore()
  const [activeTerminals, setActiveTerminals] = useState<ActiveTerminal[]>([])
  const didAutoOpenRef = useRef<string | null>(null)

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null

  // Load workspaces when project changes
  useEffect(() => {
    if (activeProjectId) {
      loadWorkspaces(activeProjectId)
    }
    // Clear terminals and reset auto-open when switching projects
    setActiveTerminals([])
    didAutoOpenRef.current = null
  }, [activeProjectId, loadWorkspaces])

  // Auto-open terminal for existing workspaces when project is first loaded
  useEffect(() => {
    if (!activeProjectId || !activeProject) return
    if (didAutoOpenRef.current === activeProjectId) return
    if (workspaces.length > 0 && activeTerminals.length === 0) {
      didAutoOpenRef.current = activeProjectId
      const ws = workspaces[0]
      setActiveTerminals([
        {
          terminalId: nanoid(),
          workspaceId: ws.id,
          workspaceName: ws.name,
          cwd: activeProject.repoPath
        }
      ])
    }
  }, [activeProjectId, activeProject, workspaces, activeTerminals.length])

  const handleNewWorkspace = useCallback(async () => {
    if (!activeProjectId || !activeProject) return
    // Mark as auto-opened so the effect doesn't duplicate
    didAutoOpenRef.current = activeProjectId
    const ws = await createWorkspace({
      projectId: activeProjectId,
      name: `Workspace ${workspaces.length + 1}`
    })
    setActiveTerminals((prev) => [
      ...prev,
      {
        terminalId: nanoid(),
        workspaceId: ws.id,
        workspaceName: ws.name,
        cwd: activeProject.repoPath
      }
    ])
  }, [activeProjectId, activeProject, workspaces.length, createWorkspace])

  const handleCloseTerminal = useCallback((terminalId: string) => {
    setActiveTerminals((prev) => prev.filter((t) => t.terminalId !== terminalId))
  }, [])

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
    <div className="flex-1 canvas-grid relative overflow-auto">
      {/* Floating new workspace button */}
      <div className="absolute top-3 right-3 z-20">
        <button
          onClick={handleNewWorkspace}
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
          New Workspace
        </button>
      </div>

      {/* Workspace panels */}
      <div className="p-6 flex flex-wrap gap-6 items-start content-start">
        {activeTerminals.map((terminal) => (
          <WorkspacePanel
            key={terminal.terminalId}
            workspaceId={terminal.workspaceId}
            workspaceName={terminal.workspaceName}
            projectId={activeProjectId}
            cwd={terminal.cwd}
            terminalId={terminal.terminalId}
            onClose={() => handleCloseTerminal(terminal.terminalId)}
          />
        ))}
      </div>

      {/* Empty state when project is selected but no terminals */}
      {activeTerminals.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-xs text-text-muted opacity-50 mb-3">
              No open workspaces
            </p>
            <button
              onClick={handleNewWorkspace}
              className="pointer-events-auto text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Create one to start working
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
