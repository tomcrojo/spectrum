import { ipcMain } from 'electron'
import { WORKSPACE_CHANNELS } from '@shared/ipc-channels'
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  updateWorkspaceLayout,
  updateWorkspaceLastPanelEditedAt,
  archiveWorkspace,
  unarchiveWorkspace,
  deleteWorkspace
} from '../db/workspaces.repo'
import type {
  CreateWorkspaceInput,
  ListWorkspacesInput,
  UpdateWorkspaceInput,
  UpdateWorkspaceLayoutInput,
  UpdateWorkspaceLastPanelEditedAtInput
} from '@shared/workspace.types'

export function registerWorkspaceHandlers(): void {
  ipcMain.handle(WORKSPACE_CHANNELS.LIST, (_event, input: string | ListWorkspacesInput) => {
    return listWorkspaces(input)
  })

  ipcMain.handle(
    WORKSPACE_CHANNELS.CREATE,
    (_event, input: CreateWorkspaceInput) => {
      return createWorkspace(input)
    }
  )

  ipcMain.handle(
    WORKSPACE_CHANNELS.UPDATE,
    (_event, input: UpdateWorkspaceInput) => {
      return updateWorkspace(input)
    }
  )

  ipcMain.handle(
    WORKSPACE_CHANNELS.UPDATE_LAYOUT,
    (_event, input: UpdateWorkspaceLayoutInput) => {
      return updateWorkspaceLayout(input)
    }
  )

  ipcMain.handle(
    WORKSPACE_CHANNELS.UPDATE_LAST_PANEL_EDITED_AT,
    (_event, input: UpdateWorkspaceLastPanelEditedAtInput) => {
      return updateWorkspaceLastPanelEditedAt(input)
    }
  )

  ipcMain.handle(WORKSPACE_CHANNELS.ARCHIVE, (_event, id: string) => {
    return archiveWorkspace(id)
  })

  ipcMain.handle(WORKSPACE_CHANNELS.UNARCHIVE, (_event, id: string) => {
    return unarchiveWorkspace(id)
  })

  ipcMain.handle(WORKSPACE_CHANNELS.DELETE, (_event, id: string) => {
    return deleteWorkspace(id)
  })
}
