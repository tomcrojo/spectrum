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
  UPDATE_LAYOUT: 'workspace:update-layout',
  UPDATE_LAST_PANEL_EDITED_AT: 'workspace:update-last-panel-edited-at',
  DELETE: 'workspace:delete',
  ARCHIVE: 'workspace:archive',
  UNARCHIVE: 'workspace:unarchive'
} as const

// Terminal channels
export const TERMINAL_CHANNELS = {
  CREATE: 'terminal:create',
  WRITE: 'terminal:write',
  RESIZE: 'terminal:resize',
  CLOSE: 'terminal:close',
  DATA: 'terminal:data' // streaming: terminal:data:<id>
} as const

// T3Code channels
export const T3CODE_CHANNELS = {
  ENSURE_RUNTIME: 't3code:ensure-runtime',
  ENSURE_PROJECT: 't3code:ensure-project',
  ENSURE_PANEL_THREAD: 't3code:ensure-panel-thread',
  GET_THREAD_INFO: 't3code:get-thread-info',
  WATCH_THREAD: 't3code:watch-thread',
  UNWATCH_THREAD: 't3code:unwatch-thread',
  THREAD_INFO_CHANGED: 't3code:thread-info-changed'
} as const

export const BROWSER_CHANNELS = {
  NAVIGATE: 'browser:navigate',
  OPEN: 'browser:open',
  CLOSE: 'browser:close',
  RESIZE: 'browser:resize',
  ACTIVATE: 'browser:activate',
  LIST: 'browser:list',
  GET: 'browser:get',
  SESSION: 'browser:session',
  SESSION_SYNC: 'browser:session-sync',
  URL_CHANGED: 'browser:url-changed',
  FOCUS_CHANGED: 'browser:focus-changed',
  WEBVIEW_READY: 'browser:webview-ready',
  WEBVIEW_DESTROYED: 'browser:webview-destroyed',
  CAPTURE_PREVIEW: 'browser:capture-preview',
  AUTOMATION_STATE_CHANGED: 'browser:automation-state-changed'
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
