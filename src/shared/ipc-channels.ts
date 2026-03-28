// Project channels
export const PROJECT_CHANNELS = {
  LIST: 'project:list',
  GET: 'project:get',
  CREATE: 'project:create',
  UPDATE: 'project:update',
  DELETE: 'project:delete'
} as const

// Task channels
export const TASK_CHANNELS = {
  LIST: 'task:list',
  CREATE: 'task:create',
  UPDATE: 'task:update',
  DELETE: 'task:delete',
  TOGGLE: 'task:toggle'
} as const

// Workspace channels
export const WORKSPACE_CHANNELS = {
  LIST: 'workspace:list',
  CREATE: 'workspace:create',
  UPDATE: 'workspace:update',
  DELETE: 'workspace:delete',
  ARCHIVE: 'workspace:archive'
} as const

// Terminal channels
export const TERMINAL_CHANNELS = {
  CREATE: 'terminal:create',
  WRITE: 'terminal:write',
  RESIZE: 'terminal:resize',
  CLOSE: 'terminal:close',
  DATA: 'terminal:data' // streaming: terminal:data:<id>
} as const

// Provider channels
export const PROVIDER_CHANNELS = {
  LIST: 'provider:list',
  SEND: 'provider:send',
  CHUNK: 'provider:chunk' // streaming: provider:chunk:<sessionId>
} as const

// Dialog channels
export const DIALOG_CHANNELS = {
  SELECT_DIRECTORY: 'dialog:select-directory'
} as const
