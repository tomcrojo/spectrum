import { useEffect } from 'react'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { ProjectCard } from '@renderer/components/sidebar/ProjectCard'
import { NewProjectButton } from '@renderer/components/sidebar/NewProjectButton'
import { Button } from '@renderer/components/shared/Button'
import { ProgressIcon } from '@renderer/components/shared/ProgressIcon'
import { cn } from '@renderer/lib/cn'
import {
  getDominantNotificationKind,
  getThreadNotificationClasses,
  getUnreadThreadNotificationKind
} from '@renderer/lib/thread-notifications'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

export function Sidebar() {
  const { projects, loadProjects } = useProjectsStore()
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const activePanels = useWorkspacesStore((state) => state.activePanels)
  const panelRuntimeById = usePanelRuntimeStore((state) => state.panelRuntimeById)
  const {
    activeProjectId,
    sidebarCollapsed,
    setActiveProject,
    toggleSidebar,
    setShowNewProjectModal,
    showSettingsPage,
    setShowSettingsPage
  } = useUiStore()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  return (
    <div className="flex flex-col h-full bg-bg-raised border-r border-border">
      {/* Drag region for frameless window */}
      <div
        className={cn(
          'drag-region h-10 flex items-end pb-1',
          sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3'
        )}
      >
        {!sidebarCollapsed && (
          <span className="no-drag text-xs font-semibold text-text-muted uppercase tracking-wider">
            Projects
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="no-drag h-7 w-7 p-0 text-text-muted hover:text-text-primary"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              !sidebarCollapsed && 'rotate-180'
            )}
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M8.75 3.25L5.25 7L8.75 10.75"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      </div>

      {/* Project list */}
      <div
        className={cn(
          'flex-1 overflow-y-auto py-2',
          sidebarCollapsed ? 'px-2 space-y-1' : 'px-2 space-y-0.5'
        )}
      >
        {sidebarCollapsed
          ? projects.map((project) => (
              (() => {
                const projectWorkspaceIds = new Set(
                  workspaces
                    .filter((workspace) => workspace.projectId === project.id)
                    .map((workspace) => workspace.id)
                )
                const notificationKinds = activePanels
                  .filter((panel) => projectWorkspaceIds.has(panel.workspaceId))
                  .map((panel) => getUnreadThreadNotificationKind(panelRuntimeById[panel.panelId]))
                const notificationKind = getDominantNotificationKind(notificationKinds)

                return (
                  <button
                    key={project.id}
                    onClick={() => setActiveProject(project.id)}
                    title={project.name}
                    aria-label={project.name}
                    className={cn(
                      'relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                      activeProjectId === project.id
                        ? 'border-border bg-bg-active'
                        : 'border-transparent hover:bg-bg-hover'
                    )}
                  >
                    <ProgressIcon progress={project.progress} />
                    {notificationKind ? (
                      <span
                        className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ${getThreadNotificationClasses(notificationKind).dot}`}
                      />
                    ) : null}
                  </button>
                )
              })()
            ))
          : projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                active={activeProjectId === project.id}
                onClick={() => setActiveProject(project.id)}
              />
            ))}

        {projects.length === 0 && (
          sidebarCollapsed ? (
            <div className="px-1 py-4 text-center text-[10px] uppercase tracking-wider text-text-muted">
              Empty
            </div>
          ) : (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-text-muted">No projects yet</p>
              <p className="text-xs text-text-muted mt-1">
                Create one to get started
              </p>
            </div>
          )
        )}
      </div>

      {/* Bottom actions */}
      <div
        className={cn(
          'border-t border-border-subtle p-2',
          sidebarCollapsed ? 'space-y-1' : 'space-y-2'
        )}
      >
        <Button
          variant="ghost"
          className={cn(
            sidebarCollapsed
              ? 'mx-auto h-10 w-10 p-0 text-text-muted hover:text-text-primary'
              : 'w-full justify-start gap-2'
          )}
          onClick={() => setShowSettingsPage(!showSettingsPage)}
          title="Settings"
          aria-label="Settings"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 1.75L8.02 2.18L9.1 1.8L10.15 2.85L9.77 3.93L10.2 4.95L11.35 5.45V6.55L10.2 7.05L9.77 8.07L10.15 9.15L9.1 10.2L8.02 9.82L7 10.25L6.5 11.4H5.4L4.9 10.25L3.88 9.82L2.8 10.2L1.75 9.15L2.13 8.07L1.7 7.05L0.55 6.55V5.45L1.7 4.95L2.13 3.93L1.75 2.85L2.8 1.8L3.88 2.18L4.9 1.75L5.4 0.6H6.5L7 1.75Z"
              stroke="currentColor"
              strokeWidth={1.1}
              strokeLinejoin="round"
            />
            <circle cx="5.95" cy="6" r="1.65" stroke="currentColor" strokeWidth={1.1} />
          </svg>
          {!sidebarCollapsed && 'Settings'}
        </Button>
        {sidebarCollapsed ? (
          <Button
            variant="ghost"
            size="sm"
            className="mx-auto h-10 w-10 p-0 text-text-muted hover:text-text-primary"
            onClick={() => setShowNewProjectModal(true)}
            title="New project"
            aria-label="New project"
          >
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
              <path
                d="M7 2.5V11.5M2.5 7H11.5"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </svg>
          </Button>
        ) : (
          <NewProjectButton onClick={() => setShowNewProjectModal(true)} />
        )}
      </div>
    </div>
  )
}
