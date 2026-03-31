import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows'
import { initDatabase, closeDatabase } from './db/database'
import { registerAllHandlers } from './ipc'
import { closeAllPtys } from './pty/PtyManager'
import { stopAllT3Code } from './t3code/T3CodeManager'
import { initWebviewSecurity } from './webview/WebviewSessionManager'
import {
  clearBrowserPanelMainWindow,
  setBrowserPanelMainWindow
} from './browser/BrowserPanelManager'
import { startApiServer, stopApiServer } from './api/BrowserApiServer'
import { shutdownCdpProxies } from './cdp/CdpProxyManager'
import { clearBrowserCliSession, touchBrowserCliSession } from './browser-cli/BrowserCliSessionManager'

function wireMainWindow(window: BrowserWindow): void {
  setBrowserPanelMainWindow(window)
  initWebviewSecurity(window)
  window.on('focus', () => {
    touchBrowserCliSession()
  })
  window.on('blur', () => {
    touchBrowserCliSession()
  })
}

function openMainWindow(): BrowserWindow {
  const window = createMainWindow()
  wireMainWindow(window)
  return window
}

function cleanupWindowScopedServices(): void {
  clearBrowserPanelMainWindow()
  closeAllPtys()
  stopAllT3Code()
  clearBrowserCliSession()
  void stopApiServer()
  void shutdownCdpProxies()
}

function cleanupAppServices(): void {
  cleanupWindowScopedServices()
  closeDatabase()
}

app.whenReady().then(() => {
  initDatabase()
  registerAllHandlers()
  openMainWindow()
  void startApiServer()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow()
      void startApiServer()
    }
  })
})

app.on('before-quit', () => {
  cleanupAppServices()
})

app.on('window-all-closed', () => {
  cleanupWindowScopedServices()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
