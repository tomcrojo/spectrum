import {
  PROJECT_CHANNELS,
  TASK_CHANNELS,
  WORKSPACE_CHANNELS,
  TERMINAL_CHANNELS,
  DIALOG_CHANNELS,
  T3CODE_CHANNELS,
  BROWSER_CHANNELS,
  FILE_CHANNELS
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
import type {
  FileTreeNode,
  OpenFileInPanelInput,
  OpenFileInPanelResult,
  ReadFileInput,
  ReadFileResult,
  StatFileInput,
  StatFileResult,
  WriteFileInput,
  WriteFileResult
} from '@shared/file.types'
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
  ensureRuntime: () =>
    invoke<{
      baseUrl: string
      logPath: string
    }>(T3CODE_CHANNELS.ENSURE_RUNTIME),
  ensureProject: (input: {
    spectrumProjectId: string
    projectPath: string
    projectName: string
  }) =>
    invoke<{
      t3ProjectId: string
    }>(T3CODE_CHANNELS.ENSURE_PROJECT, input),
  ensurePanelThread: (input: {
    panelId: string
    workspaceId: string
    spectrumProjectId: string
    projectPath: string
    projectName: string
    existingT3ProjectId?: string
    existingT3ThreadId?: string
  }) =>
    invoke<{
      baseUrl: string
      t3ProjectId: string
      t3ThreadId: string
      threadTitle: string | null
      lastUserMessageAt: string | null
      providerId: string | null
    }>(T3CODE_CHANNELS.ENSURE_PANEL_THREAD, input),
  getThreadInfo: (t3ThreadId: string) =>
    invoke<{
      url: string | null
      threadTitle: string | null
      lastUserMessageAt: string | null
      providerId: string | null
    }>(T3CODE_CHANNELS.GET_THREAD_INFO, { t3ThreadId }),
  watchThread: (input: {
    panelId: string
    t3ThreadId: string
    priority: 'focused' | 'active' | 'inactive'
  }) => invoke<boolean>(T3CODE_CHANNELS.WATCH_THREAD, input),
  unwatchThread: (panelId: string) => invoke<boolean>(T3CODE_CHANNELS.UNWATCH_THREAD, { panelId })
}

export const browserApi = {
  activate: (input: { workspaceId: string; panelId: string }) =>
    invoke<boolean>(BROWSER_CHANNELS.ACTIVATE, input),
  close: (input: { workspaceId: string; panelId: string }) =>
    invoke<boolean>(BROWSER_CHANNELS.CLOSE, input),
  snapshot: (input: {
    projectId: string | null
    activeWorkspaceId?: string | null
  }) =>
    invoke<{
      panels: Array<{
        panelId: string
        workspaceId: string
        projectId: string
        url: string
        panelTitle: string
        isTemporary?: boolean
        parentPanelId?: string
        returnToPanelId?: string
        openedBy?: 'user' | 'agent' | 'popup'
        afterPanelId?: string
        width?: number
        height?: number
      }>
      focusedBrowserPanelId: string | null
      focusedByWorkspace: Record<string, string | null>
      automationAttachedPanelIds: string[]
    }>(BROWSER_CHANNELS.SNAPSHOT, input),
  openTemporary: (input: {
    workspaceId: string
    projectId: string
    parentPanelId: string
    returnToPanelId?: string
    url: string
    width?: number
    height?: number
    openedBy?: 'agent' | 'popup'
  }) => invoke<any>(BROWSER_CHANNELS.OPEN_TEMPORARY, input),
  get: (input: { panelId: string }) =>
    invoke<any>(BROWSER_CHANNELS.GET, input),
  getSession: () => invoke<any>(BROWSER_CHANNELS.SESSION),
  sessionSync: (input: {
    activeProjectId: string | null
    activeWorkspaceId: string | null
    userFocusedPanelId?: string | null
  }) => invoke<boolean>(BROWSER_CHANNELS.SESSION_SYNC, input),
  webviewReady: (input: {
    panelId: string
    workspaceId: string
    projectId: string
    webContentsId: number
  }) => invoke<boolean>(BROWSER_CHANNELS.WEBVIEW_READY, input),
  webviewDestroyed: (input: {
    panelId?: string
    workspaceId?: string
    projectId?: string
    webContentsId?: number
  }) => invoke<boolean>(BROWSER_CHANNELS.WEBVIEW_DESTROYED, input),
  capturePreview: (input: { panelId: string }) =>
    invoke<{ dataUrl: string | null }>(BROWSER_CHANNELS.CAPTURE_PREVIEW, input),
  urlChanged: (input: {
    panelId: string
    url?: string
    panelTitle?: string
  }) => invoke<boolean>(BROWSER_CHANNELS.URL_CHANGED, input)
}

export const filesApi = {
  listTree: (projectId: string) => invoke<FileTreeNode>(FILE_CHANNELS.LIST_TREE, projectId),
  read: (input: ReadFileInput) => invoke<ReadFileResult>(FILE_CHANNELS.READ, input),
  write: (input: WriteFileInput) => invoke<WriteFileResult>(FILE_CHANNELS.WRITE, input),
  stat: (input: StatFileInput) => invoke<StatFileResult>(FILE_CHANNELS.STAT, input),
  openInPanel: (input: OpenFileInPanelInput) =>
    invoke<OpenFileInPanelResult>(FILE_CHANNELS.OPEN_IN_PANEL, input)
}

// Dialogs
export const dialogsApi = {
  selectDirectory: () =>
    invoke<string | null>(DIALOG_CHANNELS.SELECT_DIRECTORY)
}
