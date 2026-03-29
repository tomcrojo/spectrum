import {
  PROJECT_CHANNELS,
  TASK_CHANNELS,
  WORKSPACE_CHANNELS,
  TERMINAL_CHANNELS,
  DIALOG_CHANNELS,
  T3CODE_CHANNELS
} from '@shared/ipc-channels'
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Task,
  CreateTaskInput
} from '@shared/project.types'
import type {
  Workspace,
  CreateWorkspaceInput,
  ListWorkspacesInput,
  UpdateWorkspaceInput,
  UpdateWorkspaceLayoutInput,
  UpdateWorkspaceLastPanelEditedAtInput
} from '@shared/workspace.types'
import { transport } from './transport'

function invoke<T>(channel: string, ...args: any[]): Promise<T> {
  return transport.invoke(channel, ...args)
}

// Projects
export const projectsApi = {
  list: () => invoke<Project[]>(PROJECT_CHANNELS.LIST),
  get: (id: string) => invoke<Project | null>(PROJECT_CHANNELS.GET, id),
  create: (input: CreateProjectInput) =>
    invoke<Project>(PROJECT_CHANNELS.CREATE, input),
  update: (input: UpdateProjectInput) =>
    invoke<Project | null>(PROJECT_CHANNELS.UPDATE, input),
  delete: (id: string) => invoke<boolean>(PROJECT_CHANNELS.DELETE, id)
}

// Tasks
export const tasksApi = {
  list: (projectId: string) => invoke<Task[]>(TASK_CHANNELS.LIST, projectId),
  create: (input: CreateTaskInput) =>
    invoke<Task>(TASK_CHANNELS.CREATE, input),
  toggle: (id: string) => invoke<Task | null>(TASK_CHANNELS.TOGGLE, id),
  update: (id: string, title: string) =>
    invoke<Task | null>(TASK_CHANNELS.UPDATE, id, title),
  delete: (id: string) => invoke<boolean>(TASK_CHANNELS.DELETE, id)
}

// Workspaces
export const workspacesApi = {
  list: (input: string | ListWorkspacesInput) =>
    invoke<Workspace[]>(WORKSPACE_CHANNELS.LIST, input),
  create: (input: CreateWorkspaceInput) =>
    invoke<Workspace>(WORKSPACE_CHANNELS.CREATE, input),
  update: (input: UpdateWorkspaceInput) =>
    invoke<Workspace | null>(WORKSPACE_CHANNELS.UPDATE, input),
  updateLayout: (input: UpdateWorkspaceLayoutInput) =>
    invoke<Workspace | null>(WORKSPACE_CHANNELS.UPDATE_LAYOUT, input),
  updateLastPanelEditedAt: (input: UpdateWorkspaceLastPanelEditedAtInput) =>
    invoke<Workspace | null>(WORKSPACE_CHANNELS.UPDATE_LAST_PANEL_EDITED_AT, input),
  archive: (id: string) => invoke<boolean>(WORKSPACE_CHANNELS.ARCHIVE, id),
  unarchive: (id: string) => invoke<boolean>(WORKSPACE_CHANNELS.UNARCHIVE, id),
  delete: (id: string) => invoke<boolean>(WORKSPACE_CHANNELS.DELETE, id)
}

// Terminals
export const terminalsApi = {
  create: (input: {
    id: string
    cwd: string
    projectId: string
    workspaceId: string
  }) => invoke<{ id: string; pid: number }>(TERMINAL_CHANNELS.CREATE, input),
  write: (id: string, data: string) =>
    invoke<void>(TERMINAL_CHANNELS.WRITE, { id, data }),
  resize: (id: string, cols: number, rows: number) =>
    invoke<void>(TERMINAL_CHANNELS.RESIZE, { id, cols, rows }),
  close: (id: string) => invoke<void>(TERMINAL_CHANNELS.CLOSE, { id }),
  onData: (id: string, callback: (data: string) => void) =>
    transport.on(`terminal:data:${id}`, callback),
  onExit: (id: string, callback: (exitCode: number) => void) =>
    transport.on(`terminal:exit:${id}`, callback)
}

export const t3codeApi = {
  start: (instanceId: string, projectPath: string) =>
    invoke<{
      url: string
      logPath: string
      threadTitle: string | null
      lastUserMessageAt: string | null
    }>(T3CODE_CHANNELS.START, {
      instanceId,
      projectPath
    }),
  getThreadInfo: (instanceId: string, projectPath: string) =>
    invoke<{
      url: string | null
      threadTitle: string | null
      lastUserMessageAt: string | null
    }>(T3CODE_CHANNELS.GET_THREAD_INFO, {
      instanceId,
      projectPath
    }),
  stop: (instanceId: string) => invoke<void>(T3CODE_CHANNELS.STOP, instanceId)
}

// Dialogs
export const dialogsApi = {
  selectDirectory: () =>
    invoke<string | null>(DIALOG_CHANNELS.SELECT_DIRECTORY)
}
