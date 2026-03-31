import { useState } from 'react'
import { Button } from '@renderer/components/shared/Button'
import { Input } from '@renderer/components/shared/Input'
import { Modal } from '@renderer/components/shared/Modal'
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

  const handleClose = () => {
    if (isDeleting) {
      return
    }

    setConfirming(false)
    setConfirmationText('')
  }

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
      setActiveProject(nextActiveProjectId)
      setShowProjectPage(false)
      handleClose()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Danger Zone
      </h3>

      <div className="rounded-xl border border-danger/35 bg-danger/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-danger">Delete this project</h4>
            <p className="text-xs leading-5 text-text-secondary">
              Remove this project and all of its Spectrum-only metadata.
            </p>
            <p className="text-xs leading-5 text-text-muted">
              This deletes workspaces, tasks, notes, decisions, and local project state. It does not
              delete files from <span className="font-mono text-[11px] text-text-secondary">{project.repoPath}</span>.
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            className="shrink-0 border border-danger/35"
            onClick={() => setConfirming(true)}
          >
            Delete your project
          </Button>
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={handleClose}
        title="Delete Project"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-danger/30 bg-danger/6 px-4 py-3">
            <p className="text-sm font-semibold text-danger">This action cannot be undone.</p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              You are about to permanently remove <span className="font-semibold text-text-primary">{project.name}</span> from
              Spectrum.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-bg px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">What will be deleted</p>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>Project dashboard and settings</li>
              <li>All workspaces and saved panel layouts</li>
              <li>Tasks, notes, decisions, and other project metadata</li>
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-bg px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">What will stay on disk</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Your repository files at <span className="font-mono text-[12px] text-text-primary">{project.repoPath}</span> will
              not be touched.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-text-secondary">
              Type <span className="font-semibold text-text-primary">{project.name}</span> to confirm
            </label>
            <Input
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder={project.name}
              aria-label={`Type ${project.name} to confirm project deletion`}
              spellCheck={false}
              autoFocus
              className="border-danger/30 bg-bg"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="border border-danger/40"
              disabled={!requiresTypedConfirmation || isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? 'Deleting...' : 'Delete this project'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
