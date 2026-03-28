import { useEffect } from 'react'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { ProjectCard } from '@renderer/components/sidebar/ProjectCard'
import { NewProjectButton } from '@renderer/components/sidebar/NewProjectButton'

export function Sidebar() {
  const { projects, loadProjects } = useProjectsStore()
  const { activeProjectId, setActiveProject, setShowNewProjectModal } = useUiStore()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  return (
    <div className="flex flex-col h-full bg-bg-raised border-r border-border">
      {/* Drag region for frameless window */}
      <div className="drag-region h-10 flex items-end px-3 pb-1">
        <span className="no-drag text-xs font-semibold text-text-muted uppercase tracking-wider">
          Projects
        </span>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            active={activeProjectId === project.id}
            onClick={() => setActiveProject(project.id)}
          />
        ))}

        {projects.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-text-muted">No projects yet</p>
            <p className="text-xs text-text-muted mt-1">
              Create one to get started
            </p>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-2 border-t border-border-subtle">
        <NewProjectButton onClick={() => setShowNewProjectModal(true)} />
      </div>
    </div>
  )
}
