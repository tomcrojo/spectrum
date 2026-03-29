import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@renderer/stores/ui.store'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { ProjectHeader } from './ProjectHeader'
import { TaskList } from './TaskList'
import { WorkspaceList } from './WorkspaceList'
import { ProjectSettings } from './ProjectSettings'
import { PROJECT_COLOR_HEX } from '@renderer/lib/project-colors'
import type { Project, ProjectColor } from '@shared/project.types'
import { projectsApi } from '@renderer/lib/ipc'

export function ProjectPage() {
  const { activeProjectId, showProjectPage, setShowProjectPage } = useUiStore()
  const [project, setProject] = useState<Project | null>(null)
  const [localColor, setLocalColor] = useState<ProjectColor>('blue')
  const { projects, updateProject } = useProjectsStore()
  const prevProjectId = useRef<string | null>(null)

  // Fetch project data when activeProjectId or projects change
  useEffect(() => {
    if (!activeProjectId) {
      setProject(null)
      return
    }
    projectsApi.get(activeProjectId).then((p) => {
      setProject(p)
      // Only set color from backend when switching projects, not on every re-fetch
      // (to avoid overwriting optimistic local color updates)
      if (p && activeProjectId !== prevProjectId.current) {
        setLocalColor(p.color || 'blue')
        prevProjectId.current = activeProjectId
      }
    })
  }, [activeProjectId, projects])

  if (!showProjectPage || !activeProjectId || !project) {
    return null
  }

  const handleColorChange = (color: ProjectColor) => {
    setLocalColor(color) // immediate border + picker update
    updateProject({ id: project.id, color }) // persist
  }

  const colorHex = PROJECT_COLOR_HEX[localColor]

  return (
    <div
      className="w-[420px] flex-shrink-0 bg-bg-surface border-l-2 flex flex-col h-full transition-[border-color] duration-200"
      style={{ borderLeftColor: colorHex }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Project Details
        </h2>
        <button
          onClick={() => setShowProjectPage(false)}
          className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-hover"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
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
            <section className="pb-6 border-b border-border-subtle">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                Notes
              </h3>
              <p className="text-xs text-text-muted">
                Coming in Phase 4
              </p>
            </section>

            {/* Project Settings */}
            <section className="pb-6">
              <ProjectSettings
                color={localColor}
                onColorChange={handleColorChange}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
