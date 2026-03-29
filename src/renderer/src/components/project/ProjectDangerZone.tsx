import { useState } from 'react'
import { Button } from '@renderer/components/shared/Button'
import { Input } from '@renderer/components/shared/Input'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useUiStore } from '@renderer/stores/ui.store'
import type { Project } from '@shared/project.types'

interface ProjectDangerZoneProps {
  project: Project
}

export function ProjectDangerZone({ project }: ProjectDangerZoneProps) {
  const { projects, deleteProject } = useProjectsStore()
  const { activeProjectId, setActiveProject, setShowProjectPage } = useUiStore()
  const [confirming, setConfirming] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const requiresTypedConfirmation = confirmationText.trim() === project.name

  const handleDelete = async () => {
    if (!requiresTypedConfirmation || isDeleting) {
      return
    }

    setIsDeleting(true)

    try {
      const remainingProjects = projects.filter((entry) => entry.id !== project.id)
      const nextActiveProjectId =
        activeProjectId === project.id ? (remainingProjects[0]?.id ?? null) : activeProjectId

      await deleteProject(project.id)
      setShowProjectPage(false)
      setActiveProject(nextActiveProjectId)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Project Settings
      </h3>

      <div className="rounded-xl border border-danger/40 bg-danger/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-danger/25">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-danger">Delete project</h4>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                This permanently deletes the project dashboard and its local data.
                Workspaces, tasks, notes, and decisions attached to this project
                will be removed from Centipede.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="shrink-0 border border-danger/40"
              onClick={() => {
                setConfirming((value) => !value)
                setConfirmationText('')
              }}
            >
              {confirming ? 'Cancel' : 'Delete project'}
            </Button>
          </div>
        </div>

        {confirming && (
          <div className="px-4 py-4 space-y-3">
            <div className="rounded-lg border border-danger/30 bg-bg/50 px-3 py-2">
              <p className="text-xs font-medium text-text-primary">
                This action cannot be undone.
              </p>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                Type <span className="font-semibold text-text-primary">{project.name}</span> to confirm
                deletion.
              </p>
            </div>

            <Input
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder={project.name}
              aria-label={`Type ${project.name} to confirm project deletion`}
              className="border-danger/30 bg-bg"
            />

            <Button
              variant="danger"
              className="w-full border border-danger/40"
              disabled={!requiresTypedConfirmation || isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? 'Deleting...' : 'I understand, delete this project'}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
