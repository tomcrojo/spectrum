import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows'
import { initDatabase, closeDatabase } from './db/database'
import { registerAllHandlers } from './ipc'
import { closeAllPtys } from './pty/PtyManager'
import { stopAllT3Code } from './t3code/T3CodeManager'

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
  stopAllT3Code()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
