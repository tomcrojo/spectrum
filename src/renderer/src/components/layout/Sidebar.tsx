import { useEffect } from 'react'
import {
  Add01FreeIcons,
  AiSearchFreeIcons,
  AiSettingFreeIcons,
  SidebarLeft01FreeIcons,
  SidebarRight01FreeIcons
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { ProjectCard } from '@renderer/components/sidebar/ProjectCard'
import { NewProjectButton } from '@renderer/components/sidebar/NewProjectButton'
import { Button } from '@renderer/components/shared/Button'
import { ProjectAvatar } from '@renderer/components/shared/ProjectAvatar'
import { appApi } from '@renderer/lib/ipc'
import { cn } from '@renderer/lib/cn'
import {
  getDominantNotificationKind,
  getThreadNotificationClasses,
  getUnreadThreadNotificationKind
} from '@renderer/lib/thread-notifications'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

function SidebarGlyph({
  icon,
  size = 16
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  size?: number
}) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} />
}


export function Sidebar() {
  const { projects, loadProjects } = useProjectsStore()
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const activePanels = useWorkspacesStore((state) => state.activePanels)
  const panelRuntimeById = usePanelRuntimeStore((state) => state.panelRuntimeById)
  const {
    activeProjectId,
    sidebarCollapsed,
    setActiveProject,
    showProjectPage,
    setShowProjectPage,
    toggleSidebar,
    setShowNewProjectModal,
    showSettingsPage,
    setShowSettingsPage
  } = useUiStore()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Hide macOS traffic lights when sidebar is collapsed
  useEffect(() => {
    void appApi.setTrafficLightsVisible(!sidebarCollapsed)
  }, [sidebarCollapsed])

  return (
    <div
      className={cn(
        'app-glass-panel app-sidebar-shell flex h-full flex-col',
        sidebarCollapsed ? 'rounded-xl' : 'rounded-2xl'
      )}
    >
      {sidebarCollapsed ? (
        /* ── Collapsed layout ── */
        <>
          {/* Top: expand + search — matches expanded: header(40) + search(42) + nav label(26) = ~108px */}
          <div className="flex flex-col items-center justify-center gap-2 px-1.5" style={{ minHeight: 108 }}>
            <Button
              variant="secondary"
              size="sm"
              className="no-drag h-8 w-8 rounded-lg bg-transparent p-0 text-text-muted hover:bg-bg-hover/60 hover:text-text-secondary"
              onClick={toggleSidebar}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <SidebarGlyph icon={SidebarRight01FreeIcons} size={15} />
            </Button>
            <button
              type="button"
              className="no-drag flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover/60 hover:text-text-secondary"
              title="Search projects"
              aria-label="Search projects"
            >
              <SidebarGlyph icon={AiSearchFreeIcons} size={15} />
            </button>
          </div>

          {/* Middle: project avatars */}
          <div className="flex-1 space-y-1 overflow-y-auto px-1.5">
            {projects.map((project) => {
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
                  onClick={() => {
                    if (activeProjectId === project.id) {
                      setShowProjectPage(!showProjectPage)
                      return
                    }
                    setActiveProject(project.id)
                  }}
                  title={project.name}
                  aria-label={project.name}
                  className={cn(
                    'relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                    activeProjectId === project.id
                      ? 'border-border bg-bg-surface/74 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'border-transparent hover:bg-bg-hover/80'
                  )}
                >
                  <ProjectAvatar
                    icon={project.icon}
                    name={project.name}
                    color={project.color}
                    size={20}
                  />
                  {notificationKind ? (
                    <span
                      className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ${getThreadNotificationClasses(notificationKind).dot}`}
                    />
                  ) : null}
                </button>
              )
            })}
            {projects.length === 0 && (
              <div className="py-3 text-center text-[9px] uppercase tracking-wider text-text-muted">
                Empty
              </div>
            )}
          </div>

          {/* Bottom: settings + new, centered */}
          <div className="flex flex-col items-center gap-1 border-t border-border-subtle/80 px-1.5 py-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 rounded-lg border-0 bg-transparent p-0 text-text-muted shadow-none hover:bg-bg-hover/60 hover:text-text-primary"
              onClick={() => setShowSettingsPage(!showSettingsPage)}
              title="Settings"
              aria-label="Settings"
            >
              <SidebarGlyph icon={AiSettingFreeIcons} size={14} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 rounded-lg border-0 bg-transparent p-0 text-text-muted shadow-none hover:bg-bg-hover/60 hover:text-text-primary"
              onClick={() => setShowNewProjectModal(true)}
              title="New project"
              aria-label="New project"
            >
              <SidebarGlyph icon={Add01FreeIcons} size={14} />
            </Button>
          </div>
        </>
      ) : (
        /* ── Expanded layout ── */
        <>
          {/* Traffic-light row + branding */}
          <div className="drag-region relative flex h-10 items-center px-3">
            {/* Centered branding — absolute so it's centered on the full sidebar width */}
            <span
              className="no-drag absolute inset-x-0 text-center text-[13px] font-bold tracking-tight text-text-primary"
              style={{
                fontFamily: "'New York', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"
              }}
            >
              Spectrum
            </span>
            {/* Spacer for the macOS traffic-light dots */}
            <div className="w-[54px] shrink-0" />
            <div className="flex-1" />
            <Button
              variant="secondary"
              size="sm"
              className="no-drag relative z-10 h-6 w-6 shrink-0 rounded-full bg-transparent p-0 text-text-muted hover:bg-bg-hover/60 hover:text-text-secondary"
              onClick={toggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <SidebarGlyph icon={SidebarLeft01FreeIcons} size={13} />
            </Button>
          </div>

          {/* Search bar */}
          <div className="px-3 pt-2">
            <button
              type="button"
              className="no-drag flex w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border border-border/80 bg-bg-surface/70 px-3 py-2 text-left text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-colors hover:bg-bg-hover/70"
            >
              <span className="text-accent/60">
                <SidebarGlyph icon={AiSearchFreeIcons} size={14} />
              </span>
              <span className="text-text-muted">Search projects...</span>
            </button>
          </div>

          {/* Project list */}
          <div className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            <div className="px-2 pb-0.5 text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted">
              Navigator
            </div>
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
                <p className="text-sm text-text-secondary">No projects yet</p>
                <p className="mt-1 text-xs text-text-muted">Create one to get started</p>
              </div>
            )}
          </div>

          {/* Bottom actions */}
          <div className="space-y-1.5 border-t border-border-subtle/80 px-3 py-2">
            <Button
              variant="secondary"
              className="w-full justify-start gap-2.5 rounded-xl border border-border/55 bg-bg-surface/44 px-3 py-2 text-xs text-text-secondary shadow-none hover:border-border/70 hover:bg-bg-hover/52 hover:text-text-primary"
              onClick={() => setShowSettingsPage(!showSettingsPage)}
              title="Settings"
              aria-label="Settings"
            >
              <SidebarGlyph icon={AiSettingFreeIcons} size={14} />
              Settings
            </Button>
            <NewProjectButton onClick={() => setShowNewProjectModal(true)} />
          </div>
        </>
      )}
    </div>
  )
}
