import { BrowserWindow, ipcMain } from 'electron'
import { APP_CHANNELS } from '@shared/ipc-channels'

const APP_ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]
const DEFAULT_ZOOM_FACTOR = 1

function getNextZoomFactor(currentZoomFactor: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    return APP_ZOOM_STEPS.find((step) => step > currentZoomFactor + 0.001) ?? APP_ZOOM_STEPS.at(-1) ?? DEFAULT_ZOOM_FACTOR
  }

  return [...APP_ZOOM_STEPS].reverse().find((step) => step < currentZoomFactor - 0.001) ?? APP_ZOOM_STEPS[0]
}

function setZoomFactorForSender(sender: Electron.WebContents, zoomFactor: number): number {
  const window = BrowserWindow.fromWebContents(sender)
  if (!window) {
    return DEFAULT_ZOOM_FACTOR
  }

  window.webContents.setZoomFactor(zoomFactor)
  return zoomFactor
}

export function registerAppHandlers(): void {
  ipcMain.handle(APP_CHANNELS.ZOOM_IN, (event) => {
    return setZoomFactorForSender(
      event.sender,
      getNextZoomFactor(event.sender.getZoomFactor(), 'in')
    )
  })

  ipcMain.handle(APP_CHANNELS.ZOOM_OUT, (event) => {
    return setZoomFactorForSender(
      event.sender,
      getNextZoomFactor(event.sender.getZoomFactor(), 'out')
    )
  })

  ipcMain.handle(APP_CHANNELS.RESET_ZOOM, (event) => {
    return setZoomFactorForSender(event.sender, DEFAULT_ZOOM_FACTOR)
  })

  ipcMain.handle(APP_CHANNELS.SET_TRAFFIC_LIGHTS_VISIBLE, (event, visible: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || process.platform !== 'darwin') return
    window.setWindowButtonVisibility(visible)
  })
}
