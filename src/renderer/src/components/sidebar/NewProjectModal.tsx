import { useState } from 'react'
import { Modal } from '@renderer/components/shared/Modal'
import { Input, Textarea } from '@renderer/components/shared/Input'
import { Button } from '@renderer/components/shared/Button'
import { ProjectIconEditor } from '@renderer/components/shared/ProjectIconEditor'
import { useResolvedTheme } from '@renderer/lib/theme'
import { getRandomProjectColorForTheme } from '@renderer/lib/project-colors'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { dialogsApi } from '@renderer/lib/ipc'
import type { ProjectIcon } from '@shared/project.types'

export function NewProjectModal() {
  const { showNewProjectModal, setShowNewProjectModal, setActiveProject } = useUiStore()
  const { createProject } = useProjectsStore()
  const resolvedTheme = useResolvedTheme()
  const [name, setName] = useState('')
  const [repoPath, setRepoPath] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<ProjectIcon>({ type: 'repo-favicon' })
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    setShowNewProjectModal(false)
    setName('')
    setRepoPath('')
    setDescription('')
    setIcon({ type: 'repo-favicon' })
  }

  const handleSelectDir = async () => {
    const dir = await dialogsApi.selectDirectory()
    if (dir) setRepoPath(dir)
  }

  const handleCreate = async () => {
    if (!name.trim() || !repoPath.trim()) return
    setLoading(true)
    try {
      const project = await createProject({
        name: name.trim(),
        repoPath: repoPath.trim(),
        description: description.trim(),
        icon,
        color: getRandomProjectColorForTheme(resolvedTheme)
      })
      setActiveProject(project.id)
      handleClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={showNewProjectModal}
      onClose={handleClose}
      title="New Project"
      className="max-w-[38rem]"
    >
      <div className="space-y-5">
        <div className="rounded-[1.2rem] border border-border/80 bg-bg-surface/62 px-4 py-4">
          <p className="text-sm font-medium tracking-tight text-text-primary">
            Create a new cockpit
          </p>
          <p className="mt-1 text-xs leading-5 text-text-muted">
            Start with the repo, an optional description, and the project avatar you want the navigator to carry.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs text-text-secondary">
                Project Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-awesome-project"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-text-secondary">
                Repository Path
              </label>
              <div className="flex gap-2">
                <Input
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="/Users/you/projects/my-project"
                  className="flex-1"
                />
                <Button variant="secondary" size="md" onClick={handleSelectDir}>
                  Browse
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-text-secondary">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of the project"
                rows={4}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-text-secondary">
              Favicon / Icon
            </label>
            <div className="rounded-[1.2rem] border border-border/80 bg-bg-surface/62 p-3">
              <ProjectIconEditor
                value={icon}
                onChange={setIcon}
                name={name || 'New Project'}
                repoPath={repoPath}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!name.trim() || !repoPath.trim() || loading}
          >
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
