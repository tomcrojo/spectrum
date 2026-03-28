import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows'
import { initDatabase, closeDatabase } from './db/database'
import { registerAllHandlers } from './ipc'
import { closeAllPtys } from './pty/PtyManager'

app.whenReady().then(() => {
  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerAllHandlers()

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeAllPtys()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
