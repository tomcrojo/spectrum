import { contextBridge, ipcRenderer } from 'electron'

export type IpcApi = {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  on: (channel: string, callback: (...args: any[]) => void) => () => void
  once: (channel: string, callback: (...args: any[]) => void) => void
}

const api: IpcApi = {
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) =>
      callback(...args)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },
  once: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.once(
      channel,
      (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args)
    )
  }
}

contextBridge.exposeInMainWorld('api', api)
