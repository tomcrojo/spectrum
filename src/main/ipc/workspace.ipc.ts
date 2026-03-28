import { ipcMain } from 'electron'
import { WORKSPACE_CHANNELS } from '@shared/ipc-channels'
import {
  listWorkspaces,
  createWorkspace,
  archiveWorkspace,
  deleteWorkspace
} from '../db/workspaces.repo'
import type { CreateWorkspaceInput } from '@shared/workspace.types'

export function registerWorkspaceHandlers(): void {
  ipcMain.handle(WORKSPACE_CHANNELS.LIST, (_event, projectId: string) => {
    return listWorkspaces(projectId)
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.CREATE,
    (_event, input: CreateWorkspaceInput) => {
      return createWorkspace(input)
    }
  )

  ipcMain.handle(WORKSPACE_CHANNELS.ARCHIVE, (_event, id: string) => {
    return archiveWorkspace(id)
  })

  ipcMain.handle(WORKSPACE_CHANNELS.DELETE, (_event, id: string) => {
    return deleteWorkspace(id)
  })
}
