import { ipcMain } from 'electron'
import { T3CODE_CHANNELS } from '@shared/ipc-channels'
import {
  ensurePanelThread,
  ensureRuntime,
  ensureT3Project,
  getThreadInfo,
  unwatchThread,
  watchThread
} from '../t3code/T3CodeManager'

export function registerT3CodeHandlers(): void {
  ipcMain.handle(T3CODE_CHANNELS.ENSURE_RUNTIME, () => ensureRuntime())

  ipcMain.handle(
    T3CODE_CHANNELS.ENSURE_PROJECT,
    (_event, input: { centipedeProjectId: string; projectPath: string; projectName: string }) =>
      ensureT3Project(input)
  )

  ipcMain.handle(
    T3CODE_CHANNELS.ENSURE_PANEL_THREAD,
    (
      _event,
      input: {
        panelId: string
        centipedeProjectId: string
        projectPath: string
        projectName: string
        existingT3ProjectId?: string
        existingT3ThreadId?: string
      }
    ) => ensurePanelThread(input)
  )

  ipcMain.handle(
    T3CODE_CHANNELS.GET_THREAD_INFO,
    (_event, { t3ThreadId }: { t3ThreadId: string }) => {
      if (!t3ThreadId) {
        throw new Error('Missing T3Code thread id')
      }
      return getThreadInfo(t3ThreadId)
    }
  )

  ipcMain.handle(
    T3CODE_CHANNELS.WATCH_THREAD,
    (
      _event,
      input: {
        panelId: string
        t3ThreadId: string
        priority: 'focused' | 'active' | 'inactive'
      }
    ) => watchThread(input)
  )

  ipcMain.handle(T3CODE_CHANNELS.UNWATCH_THREAD, (_event, { panelId }: { panelId: string }) =>
    unwatchThread(panelId)
  )
}
