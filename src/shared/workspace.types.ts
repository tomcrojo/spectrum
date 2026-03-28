export type PanelType = 'terminal' | 'browser' | 'chat'

export interface PanelConfig {
  id: string
  type: PanelType
  title: string
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
}

export interface CreateWorkspaceInput {
  projectId: string
  name: string
}
