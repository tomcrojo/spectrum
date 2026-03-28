import { useEffect, useState } from 'react'
import { useUiStore } from '@renderer/stores/ui.store'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { ProjectHeader } from './ProjectHeader'
import { TaskList } from './TaskList'
import { WorkspaceList } from './WorkspaceList'
import type { Project } from '@shared/project.types'
import { projectsApi } from '@renderer/lib/ipc'

export function ProjectPage() {
  const { activeProjectId } = useUiStore()
  const [project, setProject] = useState<Project | null>(null)
  const { projects } = useProjectsStore()

  useEffect(() => {
    if (!activeProjectId) {
      setProject(null)
      return
    }
    projectsApi.get(activeProjectId).then((p) => setProject(p))
  }, [activeProjectId, projects])

  if (!activeProjectId || !project) {
    return (
      <div className="flex-1 flex items-center justify-center">
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <ProjectHeader project={project} />

        <div className="space-y-8">
          {/* Open Workspaces */}
          <section className="pb-6 border-b border-border-subtle">
            <WorkspaceList projectId={project.id} />
          </section>

          {/* Tasks */}
          <section className="pb-6 border-b border-border-subtle">
            <TaskList projectId={project.id} />
          </section>

          {/* Variables & Secrets — placeholder */}
          <section className="pb-6 border-b border-border-subtle">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Variables & Secrets
            </h3>
            <p className="text-xs text-text-muted">
              Coming in Phase 4
            </p>
          </section>

          {/* Decisions — placeholder */}
          <section className="pb-6 border-b border-border-subtle">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Decisions
            </h3>
            <p className="text-xs text-text-muted">
              Coming in Phase 4
            </p>
          </section>

          {/* Notes — placeholder */}
          <section className="pb-6">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Notes
            </h3>
            <p className="text-xs text-text-muted">
              Coming in Phase 4
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
