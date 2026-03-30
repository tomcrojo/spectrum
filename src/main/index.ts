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

app.whenReady().then(() => {
  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerAllHandlers()

  const mainWindow = createMainWindow()
  setBrowserPanelMainWindow(mainWindow)
  initWebviewSecurity(mainWindow)
  mainWindow.on('focus', () => {
    touchBrowserCliSession()
  })
  mainWindow.on('blur', () => {
    touchBrowserCliSession()
  })
  void startApiServer()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createMainWindow()
      setBrowserPanelMainWindow(window)
      initWebviewSecurity(window)
      window.on('focus', () => {
        touchBrowserCliSession()
      })
      window.on('blur', () => {
        touchBrowserCliSession()
      })
    }
  })
})

app.on('window-all-closed', () => {
  clearBrowserPanelMainWindow()
  closeAllPtys()
  stopAllT3Code()
  clearBrowserCliSession()
  void stopApiServer()
  void shutdownCdpProxies()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
