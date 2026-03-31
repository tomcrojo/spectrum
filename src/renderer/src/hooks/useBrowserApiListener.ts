import { useEffect } from 'react'
import { BROWSER_CHANNELS } from '@shared/ipc-channels'
import { transport } from '@renderer/lib/transport'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'

interface BrowserOpenEvent {
  panelId: string
  workspaceId: string
  projectId: string
  url: string
  panelTitle?: string
  isTemporary?: boolean
  parentPanelId?: string
  returnToPanelId?: string
  openedBy?: 'user' | 'agent' | 'popup'
  afterPanelId?: string
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
        state.updatePanelLayout(payload.panelId, {
          url: payload.url,
          width: payload.width,
          height: payload.height,
          panelTitle: payload.panelTitle
        })
        return
      }

      const nextPanel = {
        panelId: payload.panelId,
        workspaceId: payload.workspaceId,
        workspaceName: workspace.name,
        cwd: project.repoPath,
        panelType: 'browser',
        panelTitle: payload.panelTitle?.trim() || 'Browser',
        isTemporary: payload.isTemporary,
        parentPanelId: payload.parentPanelId,
        returnToPanelId: payload.returnToPanelId,
        openedBy: payload.openedBy,
        url: payload.url,
        width: payload.width,
        height: payload.height
      }

      if (payload.isTemporary && payload.afterPanelId) {
        state.addTemporaryPanelAfter(nextPanel, payload.afterPanelId)
        return
      }

      const focusedPanel = state.focusedPanelId
        ? state.activePanels.find((panel) => panel.panelId === state.focusedPanelId)
        : null

      if (focusedPanel && focusedPanel.workspaceId === payload.workspaceId) {
        state.insertPanelAfterWithoutFocus(nextPanel, focusedPanel.panelId)
      } else {
        state.addActivePanelWithoutFocus(nextPanel)
      }

      if (nextPanel.panelType === 'browser') {
        state.setFocusedBrowserPanel(nextPanel.panelId)
      }
    })

    const removeNavigate = transport.on(
      BROWSER_CHANNELS.NAVIGATE,
      (payload: BrowserNavigateEvent) => {
        useWorkspacesStore.getState().updatePanelLayout(payload.panelId, { url: payload.url })
      }
    )

    const removeClose = transport.on(BROWSER_CHANNELS.CLOSE, (payload: BrowserCloseEvent) => {
      useWorkspacesStore.getState().closeActivePanel(payload.panelId)
    })

    const removeResize = transport.on(BROWSER_CHANNELS.RESIZE, (payload: BrowserResizeEvent) => {
      useWorkspacesStore.getState().updatePanelLayout(payload.panelId, {
        width: payload.width,
        height: payload.height
      })
    })

    const removeActivate = transport.on(
      BROWSER_CHANNELS.ACTIVATE,
      (payload: { panelId: string | null }) => {
        useWorkspacesStore.getState().setFocusedBrowserPanel(payload.panelId)
      }
    )

    const removeFocusChanged = transport.on(
      BROWSER_CHANNELS.FOCUS_CHANGED,
      (payload: { panelId: string | null }) => {
        useWorkspacesStore.getState().setFocusedBrowserPanel(payload.panelId)
      }
    )

    const removeAutomationStateChanged = transport.on(
      BROWSER_CHANNELS.AUTOMATION_STATE_CHANGED,
      (payload: { panelId: string; automationAttached: boolean }) => {
        usePanelRuntimeStore.getState().updatePanelRuntime(payload.panelId, {
          browserAutomationAttached: payload.automationAttached
        })
      }
    )

    return () => {
      removeOpen()
      removeNavigate()
      removeClose()
      removeResize()
      removeActivate()
      removeFocusChanged()
      removeAutomationStateChanged()
    }
  }, [])
}
