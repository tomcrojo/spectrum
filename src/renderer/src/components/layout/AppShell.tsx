import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Canvas } from '@renderer/components/canvas/Canvas'
import { ProjectPage } from '@renderer/components/project/ProjectPage'
import { SettingsPage } from '@renderer/components/settings/SettingsPage'
import { NewProjectModal } from '@renderer/components/sidebar/NewProjectModal'
import { ThreadNotificationToasts } from '@renderer/components/shared/ThreadNotificationToast'
import { useResolvedTheme } from '@renderer/lib/theme'
import { useUiStore } from '@renderer/stores/ui.store'

export function AppShell() {
  const resolvedTheme = useResolvedTheme()
  const { sidebarCollapsed } = useUiStore()

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  return (
    <div className="flex h-screen w-screen bg-bg overflow-hidden">
      {/* Sidebar — fixed width */}
      <div
        className={
          sidebarCollapsed
            ? 'w-14 flex-shrink-0 transition-[width] duration-200'
            : 'w-60 flex-shrink-0 transition-[width] duration-200'
        }
      >
        <Sidebar />
      </div>

      {/* Main content — left detail rail + canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Project/settings detail rail — toggleable, pinned next to the sidebar */}
        <ProjectPage />
        <SettingsPage />

        {/* Canvas — always visible, fills remaining space */}
        <Canvas />
      </div>

      {/* Modals */}
      <NewProjectModal />

      {/* In-app toast notifications */}
      <ThreadNotificationToasts />
    </div>
  )
}
