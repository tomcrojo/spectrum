import { useState } from 'react'
import { Modal } from '@renderer/components/shared/Modal'
import { Input } from '@renderer/components/shared/Input'
import { Button } from '@renderer/components/shared/Button'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { dialogsApi } from '@renderer/lib/ipc'

export function NewProjectModal() {
  const { showNewProjectModal, setShowNewProjectModal, setActiveProject } = useUiStore()
  const { createProject } = useProjectsStore()
  const [name, setName] = useState('')
  const [repoPath, setRepoPath] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    setShowNewProjectModal(false)
    setName('')
    setRepoPath('')
    setDescription('')
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
        description: description.trim()
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
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-text-secondary mb-1">
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
          <label className="block text-xs text-text-secondary mb-1">
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
          <label className="block text-xs text-text-secondary mb-1">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of the project"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
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
