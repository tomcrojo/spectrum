import { cn } from '@renderer/lib/cn'
import { ProgressIcon } from '@renderer/components/shared/ProgressIcon'
import { PROJECT_COLOR_HEX } from '@renderer/lib/project-colors'
import {
  getDominantNotificationKind,
  getThreadNotificationClasses,
  getUnreadThreadNotificationKind
} from '@renderer/lib/thread-notifications'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { useUiStore } from '@renderer/stores/ui.store'
import type { Project } from '@shared/project.types'

interface ProjectCardProps {
  project: Project
  active: boolean
  onClick: () => void
}

const progressLabels = ['Starting', 'In Progress', 'Almost Done', 'Complete'] as const

export function ProjectCard({ project, active, onClick }: ProjectCardProps) {
  const { showProjectPage, toggleProjectPage } = useUiStore()
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const activePanels = useWorkspacesStore((state) => state.activePanels)
  const panelRuntimeById = usePanelRuntimeStore((state) => state.panelRuntimeById)
  const isProjectPageOpen = active && showProjectPage
  const colorHex = PROJECT_COLOR_HEX[project.color]
  const projectWorkspaceIds = new Set(
    workspaces.filter((workspace) => workspace.projectId === project.id).map((workspace) => workspace.id)
  )
  const notificationKinds = activePanels
    .filter((panel) => projectWorkspaceIds.has(panel.workspaceId))
    .map((panel) => getUnreadThreadNotificationKind(panelRuntimeById[panel.panelId]))
  const projectNotificationKind = getDominantNotificationKind(notificationKinds)
  const hasUnreadNotification = notificationKinds.some(Boolean)

  const handleArrowClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!active) {
      onClick()
      setTimeout(() => useUiStore.getState().setShowProjectPage(true), 0)
    } else {
      toggleProjectPage()
    }
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group',
        'border border-transparent',
        active
          ? 'bg-bg-active border-border'
          : 'hover:bg-bg-hover'
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        <ProgressIcon progress={project.progress} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-text-primary truncate flex-1">
              {project.name}
            </div>
            {hasUnreadNotification ? (
              <span
                className={`h-2.5 w-2.5 rounded-full ring-4 ${getThreadNotificationClasses(projectNotificationKind).dot}`}
                title="Unread workspace notification"
              />
            ) : null}
          </div>
        </div>
        <div
          onClick={handleArrowClick}
          className={cn(
            'no-drag flex items-center justify-center rounded-md transition-all duration-150',
            'w-5 h-8',
            active
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-50'
          )}
          style={
            active
              ? isProjectPageOpen
                ? { background: '#e5e5e5' }
                : { background: colorHex }
              : undefined
          }
        >
          <svg
            className={cn(
              'w-3 h-3 transition-transform duration-200',
              isProjectPageOpen ? 'rotate-180' : '',
              active
                ? isProjectPageOpen
                  ? 'text-neutral-700'
                  : 'text-white'
                : 'text-text-muted'
            )}
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="mt-1 ml-5 text-xs text-text-muted truncate">
        {progressLabels[project.progress]}
        {project.description && ` · ${project.description}`}
      </div>
    </button>
  )
}
