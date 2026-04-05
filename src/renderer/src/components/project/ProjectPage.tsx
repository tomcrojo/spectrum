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

const placeholderSections = [
  {
    title: 'Variables & Secrets',
    description: 'Project-scoped runtime variables will land here once secrets management is wired.'
  },
  {
    title: 'Decisions',
    description: 'Architecture notes and tradeoffs will become the long-term memory for each project.'
  },
  {
    title: 'Notes',
    description: 'Freeform notes will sit alongside decisions, separate from the chat and canvas.'
  }
] as const

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
      <button
        onClick={() => setShowProjectPage(false)}
        className="absolute right-4 top-4 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-bg-hover/40 text-text-muted backdrop-blur-sm transition-all duration-200 hover:bg-bg-hover/80 hover:text-text-primary hover:scale-105"
      >
        <svg className="w-3 h-3" viewBox="0 0 14 14" fill="none">
          <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </button>

      <div className="project-theme-scroll flex-1 overflow-y-auto">
        <div className="px-5 pb-6 pt-11">
          <ProjectHeader
            project={project}
            color={localColor}
            onColorChange={handleColorChange}
          />

          <div className="mt-6">
            <section className="project-theme-card rounded-xl px-3.5 py-3.5 mb-5">
              <WorkspaceList projectId={project.id} />
            </section>

            <section className="border-t border-border/40 py-5">
              <TaskList projectId={project.id} />
            </section>

            <section className="border-t border-border/40 py-5 opacity-65">
              <div className="space-y-0">
                {placeholderSections.map((section, index) => (
                  <div
                    key={section.title}
                    className={index === 0 ? '' : 'border-t border-border/30 pt-4 mt-4'}
                  >
                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                      {section.title}
                    </h3>
                    <p className="max-w-[34ch] text-[12px] leading-relaxed text-text-muted">
                      {section.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-border/40 pt-5">
              <ProjectDangerZone project={project} />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
