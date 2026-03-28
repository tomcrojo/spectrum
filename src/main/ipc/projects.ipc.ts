import { ipcMain, dialog } from 'electron'
import { PROJECT_CHANNELS, TASK_CHANNELS, DIALOG_CHANNELS } from '@shared/ipc-channels'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} from '../db/projects.repo'
import {
  listTasks,
  createTask,
  toggleTask,
  updateTask,
  deleteTask
} from '../db/tasks.repo'
import type { CreateProjectInput, UpdateProjectInput, CreateTaskInput } from '@shared/project.types'

export function registerProjectHandlers(): void {
  // Projects
  ipcMain.handle(PROJECT_CHANNELS.LIST, () => {
    return listProjects()
  })

  ipcMain.handle(PROJECT_CHANNELS.GET, (_event, id: string) => {
    return getProject(id)
  })

  ipcMain.handle(PROJECT_CHANNELS.CREATE, (_event, input: CreateProjectInput) => {
    return createProject(input)
  })

  ipcMain.handle(PROJECT_CHANNELS.UPDATE, (_event, input: UpdateProjectInput) => {
    return updateProject(input)
  })

  ipcMain.handle(PROJECT_CHANNELS.DELETE, (_event, id: string) => {
    return deleteProject(id)
  })

  // Tasks
  ipcMain.handle(TASK_CHANNELS.LIST, (_event, projectId: string) => {
    return listTasks(projectId)
  })

  ipcMain.handle(TASK_CHANNELS.CREATE, (_event, input: CreateTaskInput) => {
    return createTask(input)
  })

  ipcMain.handle(TASK_CHANNELS.TOGGLE, (_event, id: string) => {
    return toggleTask(id)
  })

  ipcMain.handle(
    TASK_CHANNELS.UPDATE,
    (_event, id: string, title: string) => {
      return updateTask(id, title)
    }
  )

  ipcMain.handle(TASK_CHANNELS.DELETE, (_event, id: string) => {
    return deleteTask(id)
  })

  // Dialogs
  ipcMain.handle(DIALOG_CHANNELS.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
