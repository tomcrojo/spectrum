import { ipcMain } from 'electron'
import { T3CODE_CHANNELS } from '@shared/ipc-channels'
import { getT3CodeThreadInfo, startT3Code, stopT3Code } from '../t3code/T3CodeManager'

export function registerT3CodeHandlers(): void {
  ipcMain.handle(
    T3CODE_CHANNELS.START,
    async (
      _event,
      {
        instanceId,
        workspaceId,
        projectId,
        projectPath
      }: {
        instanceId?: string
        workspaceId?: string
        projectId?: string
        projectPath: string
      }
    ) => {
      const resolvedInstanceId = instanceId ?? workspaceId
      if (!resolvedInstanceId) {
        throw new Error('Missing T3Code panel instance id')
      }
      return startT3Code(resolvedInstanceId, projectPath, {
        workspaceId,
        projectId
      })
    }
  )

  ipcMain.handle(
    T3CODE_CHANNELS.STOP,
    (
      _event,
      payload: string | { instanceId?: string; workspaceId?: string }
    ) => {
      const resolvedInstanceId =
        typeof payload === 'string'
          ? payload
          : payload.instanceId ?? payload.workspaceId

      if (!resolvedInstanceId) {
        throw new Error('Missing T3Code panel instance id')
      }

      stopT3Code(resolvedInstanceId)
    }
  )

  ipcMain.handle(
    T3CODE_CHANNELS.GET_THREAD_INFO,
    (
      _event,
      {
        instanceId,
        workspaceId,
        projectPath
      }: {
        instanceId?: string
        workspaceId?: string
        projectPath: string
      }
    ) => {
      const resolvedInstanceId = instanceId ?? workspaceId
      if (!resolvedInstanceId) {
        throw new Error('Missing T3Code panel instance id')
      }

      return getT3CodeThreadInfo(resolvedInstanceId, projectPath)
    }
  )
}
