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
