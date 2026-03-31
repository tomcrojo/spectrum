import { ipcMain, webContents } from 'electron'
import { BROWSER_CHANNELS } from '@shared/ipc-channels'
import {
  activateBrowserPanel,
  bindBrowserPanelWebContents,
  ensureBrowserPanelState,
  getBrowserPanel,
  openTemporaryBrowserPanel,
  setFocusedBrowserPanel,
  unbindBrowserPanelByWebContentsId,
  updateBrowserPanelFromRenderer
} from '../browser/BrowserPanelManager'
import {
  registerCdpTarget,
  setCdpAutomationStateListener,
  unregisterCdpTarget,
  updateCdpTarget
} from '../cdp/CdpProxyManager'
import { isKnownWebviewId } from '../webview/WebviewSessionManager'
import {
  touchBrowserCliSession,
  updateBrowserCliSessionScope
} from '../browser-cli/BrowserCliSessionManager'

interface WebviewReadyPayload {
  panelId: string
  workspaceId: string
  projectId: string
  webContentsId: number
}

interface WebviewDestroyedPayload {
  panelId?: string
  webContentsId?: number
}

interface UrlChangedPayload {
  panelId: string
  url?: string
  panelTitle?: string
}

interface SessionSyncPayload {
  activeProjectId: string | null
  activeWorkspaceId: string | null
  focusedBrowserPanelId: string | null
  userFocusedPanelId?: string | null
}

export function registerBrowserHandlers(): void {
  setCdpAutomationStateListener((payload) => {
    _eventSender(payload)
  })

  ipcMain.handle(BROWSER_CHANNELS.WEBVIEW_READY, async (_event, payload: WebviewReadyPayload) => {
    if (!isKnownWebviewId(payload.webContentsId)) {
      throw new Error(`Unknown webview id: ${payload.webContentsId}`)
    }

    const panel =
      getBrowserPanel(payload.panelId) ??
      ensureBrowserPanelState({
        panelId: payload.panelId,
        workspaceId: payload.workspaceId,
        projectId: payload.projectId
      })
    if (panel.workspaceId !== payload.workspaceId || panel.projectId !== payload.projectId) {
      throw new Error('Webview registration does not match panel scope')
    }

    bindBrowserPanelWebContents({
      panelId: payload.panelId,
      webContentsId: payload.webContentsId
    })

    await registerCdpTarget({
      workspaceId: payload.workspaceId,
      webContentsId: payload.webContentsId,
      panelId: payload.panelId,
      title: panel.panelTitle,
      url: panel.url
    })
    touchBrowserCliSession()

    return true
  })

  ipcMain.handle(BROWSER_CHANNELS.WEBVIEW_DESTROYED, async (_event, payload: WebviewDestroyedPayload) => {
    if (typeof payload.webContentsId === 'number') {
      const panel = unbindBrowserPanelByWebContentsId(payload.webContentsId)
      if (panel) {
        await unregisterCdpTarget({
          workspaceId: panel.workspaceId,
          webContentsId: payload.webContentsId
        })
        touchBrowserCliSession()
      }
      return true
    }

    if (typeof payload.panelId === 'string') {
      const panel = getBrowserPanel(payload.panelId)
      if (!panel || typeof panel.webContentsId !== 'number') {
        return false
      }
      const webContentsId = panel.webContentsId
      unbindBrowserPanelByWebContentsId(webContentsId)
      await unregisterCdpTarget({
        workspaceId: panel.workspaceId,
        webContentsId
      })
      touchBrowserCliSession()
      return true
    }

    return false
  })

  ipcMain.handle(BROWSER_CHANNELS.URL_CHANGED, (_event, payload: UrlChangedPayload) => {
    const panel = updateBrowserPanelFromRenderer({
      panelId: payload.panelId,
      url: payload.url,
      panelTitle: payload.panelTitle
    })

    if (panel && typeof panel.webContentsId === 'number') {
      updateCdpTarget({
        webContentsId: panel.webContentsId,
        title: panel.panelTitle,
        url: panel.url
      })
    }

    return Boolean(panel)
  })

  ipcMain.handle(BROWSER_CHANNELS.SESSION_SYNC, (_event, payload: SessionSyncPayload) => {
    updateBrowserCliSessionScope(payload)

    if (payload.activeWorkspaceId) {
      setFocusedBrowserPanel(payload.activeWorkspaceId, payload.focusedBrowserPanelId)
    }

    return true
  })

  ipcMain.handle(
    BROWSER_CHANNELS.OPEN_TEMPORARY,
    (
      _event,
      payload: {
        workspaceId: string
        projectId: string
        parentPanelId: string
        returnToPanelId?: string
        url: string
        width?: number
        height?: number
        openedBy?: 'agent' | 'popup'
      }
    ) => {
      const panel = openTemporaryBrowserPanel({
        workspaceId: payload.workspaceId,
        projectId: payload.projectId,
        parentPanelId: payload.parentPanelId,
        returnToPanelId: payload.returnToPanelId,
        url: payload.url,
        width: payload.width,
        height: payload.height,
        openedBy: payload.openedBy
      })
      return panel
    }
  )

  ipcMain.handle(
    BROWSER_CHANNELS.ACTIVATE,
    (_event, payload: { workspaceId: string; panelId: string }) => {
      const panel = activateBrowserPanel(payload.workspaceId, payload.panelId)
      if (panel) {
        touchBrowserCliSession()
      }
      return Boolean(panel)
    }
  )

  ipcMain.handle(BROWSER_CHANNELS.CAPTURE_PREVIEW, async (_event, payload: { panelId: string }) => {
    const panel = getBrowserPanel(payload.panelId)
    if (!panel || typeof panel.webContentsId !== 'number') {
      return { dataUrl: null }
    }

    const guestContents = webContents.fromId(panel.webContentsId)
    if (!guestContents || guestContents.isDestroyed()) {
      return { dataUrl: null }
    }

    const image = await guestContents.capturePage()
    const resized = image.resize({
      width: 640,
      height: 400,
      quality: 'good'
    })

    return {
      dataUrl: `data:image/jpeg;base64,${resized.toJPEG(60).toString('base64')}`
    }
  })
}

function _eventSender(payload: { panelId: string; automationAttached: boolean }): void {
  for (const window of webContents.getAllWebContents()) {
    if (window.getType() === 'window') {
      window.send(BROWSER_CHANNELS.AUTOMATION_STATE_CHANGED, payload)
    }
  }
}
