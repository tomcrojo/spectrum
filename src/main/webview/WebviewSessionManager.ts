import { BrowserWindow } from 'electron'
import {
  getBrowserPanelByWebContentsId,
  unbindBrowserPanelByWebContentsId
} from '../browser/BrowserPanelManager'
import { unregisterCdpTarget } from '../cdp/CdpProxyManager'

const knownWebviewIds = new Set<number>()

export function isKnownWebviewId(webContentsId: number): boolean {
  return knownWebviewIds.has(webContentsId)
}

export function clearKnownWebviews(): void {
  knownWebviewIds.clear()
}

function describePanelScope(webContentsId: number): string {
  const panel = getBrowserPanelByWebContentsId(webContentsId)
  if (!panel) {
    console.warn(
      `[webview] Unable to resolve browser panel for guest ${webContentsId}; dropping panel-scoped work`
    )
    return `guest:${webContentsId}`
  }

  return `panel:${panel.panelId} workspace:${panel.workspaceId}`
}

export function initWebviewSecurity(mainWindow: BrowserWindow): void {
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      const allowed = new Set(['fullscreen'])
      callback(allowed.has(permission))
    }
  )

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    const partition = typeof params.partition === 'string' ? params.partition : ''
    if (!partition.startsWith('persist:project-')) {
      event.preventDefault()
      return
    }

    delete (webPreferences as any).preload
    delete (webPreferences as any).preloadURL
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
  })

  mainWindow.webContents.on('did-attach-webview', (_event, guestWebContents) => {
    const guestId = guestWebContents.id
    knownWebviewIds.add(guestId)

    guestWebContents.on('render-process-gone', (_event, details) => {
      console.warn(
        `[webview] render-process-gone ${describePanelScope(guestId)} reason=${details.reason} exitCode=${details.exitCode}`
      )
    })

    guestWebContents.on('unresponsive', () => {
      console.warn(`[webview] unresponsive ${describePanelScope(guestId)}`)
    })

    guestWebContents.on('responsive', () => {
      console.info(`[webview] responsive ${describePanelScope(guestId)}`)
    })

    guestWebContents.once('destroyed', () => {
      knownWebviewIds.delete(guestId)
      const panel = getBrowserPanelByWebContentsId(guestId)
      if (!panel) {
        return
      }

      unbindBrowserPanelByWebContentsId(guestId)
      void unregisterCdpTarget({
        workspaceId: panel.workspaceId,
        webContentsId: guestId
      })
    })
  })
}
