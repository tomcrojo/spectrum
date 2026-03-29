import { useEffect } from 'react'
import { BROWSER_CHANNELS } from '@shared/ipc-channels'
import { transport } from '@renderer/lib/transport'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

interface BrowserOpenEvent {
  panelId: string
  workspaceId: string
  projectId: string
  url: string
  panelTitle?: string
  width?: number
  height?: number
}

interface BrowserNavigateEvent {
  panelId: string
  workspaceId: string
  url: string
}

interface BrowserCloseEvent {
  panelId: string
  workspaceId: string
}

interface BrowserResizeEvent {
  panelId: string
  workspaceId: string
  width: number
  height: number
}

export function useBrowserApiListener(): void {
  useEffect(() => {
    const removeOpen = transport.on(BROWSER_CHANNELS.OPEN, (payload: BrowserOpenEvent) => {
      const state = useWorkspacesStore.getState()
      const project = useProjectsStore.getState().projects.find((entry) => entry.id === payload.projectId)
      const workspace = state.workspaces.find((entry) => entry.id === payload.workspaceId)

      if (!project || !workspace) {
        return
      }

      if (state.activePanels.some((panel) => panel.panelId === payload.panelId)) {
        state.updatePanel(payload.panelId, {
          url: payload.url,
          width: payload.width,
          height: payload.height,
          panelTitle: payload.panelTitle
        })
        return
      }

      state.addActivePanel({
        panelId: payload.panelId,
        workspaceId: payload.workspaceId,
        workspaceName: workspace.name,
        cwd: project.repoPath,
        panelType: 'browser',
        panelTitle: payload.panelTitle?.trim() || 'Browser',
        url: payload.url,
        width: payload.width,
        height: payload.height
      })
    })

    const removeNavigate = transport.on(
      BROWSER_CHANNELS.NAVIGATE,
      (payload: BrowserNavigateEvent) => {
        useWorkspacesStore.getState().updatePanel(payload.panelId, { url: payload.url })
      }
    )

    const removeClose = transport.on(BROWSER_CHANNELS.CLOSE, (payload: BrowserCloseEvent) => {
      useWorkspacesStore.getState().closeActivePanel(payload.panelId)
    })

    const removeResize = transport.on(BROWSER_CHANNELS.RESIZE, (payload: BrowserResizeEvent) => {
      useWorkspacesStore.getState().updatePanel(payload.panelId, {
        width: payload.width,
        height: payload.height
      })
    })

    return () => {
      removeOpen()
      removeNavigate()
      removeClose()
      removeResize()
    }
  }, [])
}
