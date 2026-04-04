import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@renderer/stores/ui.store'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { ProjectHeader } from './ProjectHeader'
import { TaskList } from './TaskList'
import { WorkspaceList } from './WorkspaceList'
import { ProjectDangerZone } from './ProjectDangerZone'
import { getProjectThemeStyle } from '@renderer/lib/project-colors'
import { DEFAULT_PROJECT_COLOR, type Project, type ProjectColor } from '@shared/project.types'
import { projectsApi } from '@renderer/lib/ipc'

export function ProjectPage() {
  const { activeProjectId, showProjectPage, setShowProjectPage } = useUiStore()
  const [project, setProject] = useState<Project | null>(null)
  const [localColor, setLocalColor] = useState<ProjectColor>(DEFAULT_PROJECT_COLOR)
  const { projects, updateProject } = useProjectsStore()
  const prevProjectId = useRef<string | null>(null)

  // Fetch project data when activeProjectId or projects change
  useEffect(() => {
    let isStale = false

    if (!activeProjectId) {
      setProject(null)
      return
    }

    setProject(null)

    projectsApi.get(activeProjectId).then((p) => {
      if (isStale) {
        return
      }

      setProject(p)
      // Only set color from backend when switching projects, not on every re-fetch
      // (to avoid overwriting optimistic local color updates)
      if (p && activeProjectId !== prevProjectId.current) {
        setLocalColor(p.color)
        prevProjectId.current = activeProjectId
      }
    })

    return () => {
      isStale = true
    }
  }, [activeProjectId, projects])

  if (!showProjectPage || !activeProjectId || !project) {
    return null
  }

  const handleColorChange = (color: ProjectColor) => {
    setLocalColor(color) // immediate border + picker update
    updateProject({ id: project.id, color }) // persist
  }

  return (
    <div
      className="project-theme-shell w-[480px] flex-shrink-0 rounded-[1.4rem] flex flex-col h-[calc(100%-16px)] self-center mr-1.5 ml-1.5 overflow-hidden"
      style={getProjectThemeStyle(localColor)}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.18em]">
          Project Dashboard
        </h2>
        <button
          onClick={() => setShowProjectPage(false)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="project-theme-scroll flex-1 overflow-y-auto">
        <div className="px-4 pb-4 pt-0.5">
          <ProjectHeader
            project={project}
            color={localColor}
            onColorChange={handleColorChange}
          />

          <div className="space-y-3">
            <section className="project-theme-card rounded-xl px-3 py-3">
              <WorkspaceList projectId={project.id} />
            </section>

            <div className="px-1.5">
              <section className="project-theme-section">
                <TaskList projectId={project.id} />
              </section>

              <section className="project-theme-section">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Variables & Secrets
                </h3>
                <p className="text-[13px] text-text-secondary">
                  Project-scoped runtime variables will land here once secrets management is wired.
                </p>
              </section>

              <section className="project-theme-section">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Decisions
                </h3>
                <p className="text-[13px] text-text-secondary">
                  Architecture notes and tradeoffs will become the long-term memory for each project.
                </p>
              </section>

              <section className="project-theme-section">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Notes
                </h3>
                <p className="text-[13px] text-text-secondary">
                  Freeform notes will sit alongside decisions, separate from the chat and canvas.
                </p>
              </section>

              <section className="project-theme-section pb-0">
                <ProjectDangerZone project={project} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
