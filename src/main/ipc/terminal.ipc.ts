import { ipcMain, BrowserWindow } from 'electron'
import { TERMINAL_CHANNELS } from '@shared/ipc-channels'
import { createPty, writePty, resizePty, closePty } from '../pty/PtyManager'

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    TERMINAL_CHANNELS.CREATE,
    (event, { id, cwd, projectId, workspaceId }) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) throw new Error('No window found for terminal creation')
      return createPty(id, cwd, projectId, workspaceId, window)
    }
  )

  ipcMain.handle(TERMINAL_CHANNELS.WRITE, (_event, { id, data }) => {
    writePty(id, data)
  })

  ipcMain.handle(TERMINAL_CHANNELS.RESIZE, (_event, { id, cols, rows }) => {
    resizePty(id, cols, rows)
  })

  ipcMain.handle(TERMINAL_CHANNELS.CLOSE, (_event, { id }) => {
    closePty(id)
  })
}
