import { useEffect } from 'react'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { ProgressIcon } from '@renderer/components/shared/ProgressIcon'
import { Button } from '@renderer/components/shared/Button'

interface WorkspaceListProps {
  projectId: string
}

export function WorkspaceList({ projectId }: WorkspaceListProps) {
  const { workspaces, loadWorkspaces, createWorkspace } = useWorkspacesStore()

  useEffect(() => {
    loadWorkspaces(projectId)
  }, [projectId, loadWorkspaces])

  const handleCreate = async () => {
    await createWorkspace({
      projectId,
      name: `Workspace ${workspaces.length + 1}`
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Open Workspaces
        </h3>
        <Button variant="ghost" size="sm" onClick={handleCreate}>
          + Add
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <p className="text-xs text-text-muted py-2">
          No workspaces yet. Create one to start working.
        </p>
      ) : (
        <div className="space-y-1">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover transition-colors cursor-pointer"
            >
              <ProgressIcon progress={0} size={12} />
              <span className="text-sm text-text-primary flex-1">
                {ws.name}
              </span>
              <span className="text-xs text-text-muted">
                {ws.layoutState.panels.length} panels
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
