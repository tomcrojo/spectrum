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
import { clearYellowSession } from './yellow/YellowSessionManager'

app.whenReady().then(() => {
  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerAllHandlers()

  const mainWindow = createMainWindow()
  setBrowserPanelMainWindow(mainWindow)
  initWebviewSecurity(mainWindow)
  void startApiServer()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createMainWindow()
      setBrowserPanelMainWindow(window)
      initWebviewSecurity(window)
    }
  })
})

app.on('window-all-closed', () => {
  clearBrowserPanelMainWindow()
  closeAllPtys()
  stopAllT3Code()
  clearYellowSession()
  void stopApiServer()
  void shutdownCdpProxies()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
