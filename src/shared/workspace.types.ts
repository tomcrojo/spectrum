export type PanelType = 'terminal' | 'browser' | 'chat' | 't3code' | 'file'
export type PanelHydrationState = 'live' | 'preview' | 'cold'

export interface PanelConfig {
  id: string
  type: PanelType
  title: string
  providerId?: string
  filePath?: string
  cursorLine?: number
  cursorColumn?: number
  /** T3Code project binding for persisted t3code panels */
  t3ProjectId?: string
  /** T3Code thread binding for persisted t3code panels */
  t3ThreadId?: string
  /** Browser URL — persisted so the page reloads where the user left off */
  url?: string
  /** Panel width in px */
  width?: number
  /** Panel height in px */
  height?: number
}

export interface WorkspaceLayoutState {
  panels: PanelConfig[]
  sizes: number[]
}

export interface Workspace {
  id: string
  projectId: string
  name: string
  layoutState: WorkspaceLayoutState
  archived: boolean
  createdAt: string
  updatedAt: string
  lastPanelEditedAt: string | null
}

export interface CreateWorkspaceInput {
  projectId: string
  name: string
  layoutState?: WorkspaceLayoutState
}

export interface ListWorkspacesInput {
  projectId: string
  includeArchived?: boolean
}

export interface UpdateWorkspaceInput {
  id: string
  name?: string
  archived?: boolean
}

export interface UpdateWorkspaceLayoutInput {
  id: string
  layoutState: WorkspaceLayoutState
}

export interface UpdateWorkspaceLastPanelEditedAtInput {
  id: string
  timestamp: string
}
