import { cn } from '@renderer/lib/cn'
import { ProgressIcon } from '@renderer/components/shared/ProgressIcon'
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

  const handleArrowClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!active) {
      // If clicking arrow on inactive project, first select it then show project page
      onClick()
      // Small delay to let the project become active, then show project page
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
      <div className="flex items-center gap-2 min-w-0">
        <ProgressIcon progress={project.progress} />
        <span className="text-sm font-medium text-text-primary truncate flex-1">
          {project.name}
        </span>
        <div
          onClick={handleArrowClick}
          className={cn(
            'no-drag p-0.5 rounded transition-all hover:bg-bg-hover',
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
          )}
        >
          <svg
            className={cn(
              'w-3 h-3 text-text-muted transition-transform duration-200',
              active && showProjectPage && 'rotate-180'
            )}
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="mt-0.5 ml-5 text-xs text-text-muted truncate">
        {progressLabels[project.progress]}
        {project.description && ` · ${project.description}`}
      </div>
    </button>
  )
}
