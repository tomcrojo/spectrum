import { ArrowRight01FreeIcons } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@renderer/lib/cn'
import { ProjectAvatar } from '@renderer/components/shared/ProjectAvatar'
import { getProjectThemeStyle } from '@renderer/lib/project-colors'
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

export function ProjectCard({ project, active, onClick }: ProjectCardProps) {
  const { showProjectPage, toggleProjectPage } = useUiStore()
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const activePanels = useWorkspacesStore((state) => state.activePanels)
  const panelRuntimeById = usePanelRuntimeStore((state) => state.panelRuntimeById)
  const isProjectPageOpen = active && showProjectPage
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
        'group w-full rounded-xl border px-2.5 py-2 text-left transition-all duration-150',
        active
          ? 'project-sidebar-card-active'
          : 'border-transparent hover:bg-bg-hover/80'
      )}
      style={active ? getProjectThemeStyle(project.color) : undefined}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <ProjectAvatar icon={project.icon} name={project.name} color={project.color} size={20} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate text-[13px] font-medium tracking-tight text-text-primary">
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
            'no-drag flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150',
            active
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-60'
          )}
          style={
            active
              ? isProjectPageOpen
                ? { background: 'rgba(255, 255, 255, 0.72)' }
                : { background: 'var(--project-accent)' }
              : undefined
          }
        >
          <HugeiconsIcon
            icon={ArrowRight01FreeIcons}
            size={14}
            strokeWidth={1.8}
            className={cn(
              'transition-transform duration-200',
              isProjectPageOpen ? 'rotate-90' : '',
              active
                ? isProjectPageOpen
                  ? 'text-neutral-700'
                  : 'text-white'
                : 'text-text-muted'
            )}
          />
        </div>
      </div>
    </button>
  )
}
