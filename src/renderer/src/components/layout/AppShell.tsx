import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Canvas } from '@renderer/components/canvas/Canvas'
import { ProjectPage } from '@renderer/components/project/ProjectPage'
import { SettingsPage } from '@renderer/components/settings/SettingsPage'
import { NewProjectModal } from '@renderer/components/sidebar/NewProjectModal'
import { ThreadNotificationToasts } from '@renderer/components/shared/ThreadNotificationToast'
import { appApi } from '@renderer/lib/ipc'
import { useResolvedTheme } from '@renderer/lib/theme'
import { useUiStore } from '@renderer/stores/ui.store'

function hasZoomModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

function isZoomInShortcut(event: KeyboardEvent): boolean {
  return (
    event.key === '+' ||
    event.code === 'NumpadAdd' ||
    (event.shiftKey && event.code === 'Equal')
  )
}

function isZoomOutShortcut(event: KeyboardEvent): boolean {
  return event.key === '-' || event.code === 'NumpadSubtract'
}

export function AppShell() {
  const resolvedTheme = useResolvedTheme()
  const { sidebarCollapsed } = useUiStore()

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!hasZoomModifier(event)) {
        return
      }

      const activeElement = document.activeElement
      if (
        activeElement instanceof HTMLElement &&
        activeElement.closest('[data-canvas-scroll-root="true"]')
      ) {
        return
      }

      if (isZoomInShortcut(event)) {
        event.preventDefault()
        void appApi.zoomIn()
        return
      }

      if (isZoomOutShortcut(event)) {
        event.preventDefault()
        void appApi.zoomOut()
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        void appApi.resetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="app-shell-backdrop flex h-screen w-screen gap-1.5 overflow-hidden p-1.5">
      {/* Sidebar — fixed width */}
      <div
        className={
          sidebarCollapsed
            ? 'w-[3.25rem] flex-shrink-0 transition-[width] duration-200'
            : 'w-[15rem] flex-shrink-0 transition-[width] duration-200'
        }
      >
        <Sidebar />
      </div>

      {/* Main content — left detail rail + canvas */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
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
