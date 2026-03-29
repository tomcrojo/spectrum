export const PROJECT_COLORS = [
  'slate', 'red', 'orange', 'amber', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
] as const

export type ProjectColor = (typeof PROJECT_COLORS)[number]

export interface Project {
  id: string
  name: string
  repoPath: string
  description: string
  progress: 0 | 1 | 2 | 3 // maps to ◔ ◑ ◕ ⚫
  color: ProjectColor
  gitWorkspacesEnabled: boolean
  defaultBrowserCookiePolicy: 'isolated' | 'shared'
  defaultTerminalMode: 'project-root' | 'workspace'
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  repoPath: string
  description?: string
  color?: ProjectColor
  gitWorkspacesEnabled?: boolean
}

export interface UpdateProjectInput {
  id: string
  name?: string
  description?: string
  progress?: 0 | 1 | 2 | 3
  color?: ProjectColor
  gitWorkspacesEnabled?: boolean
  defaultBrowserCookiePolicy?: 'isolated' | 'shared'
  defaultTerminalMode?: 'project-root' | 'workspace'
  archived?: boolean
}

export interface Task {
  id: string
  projectId: string
  title: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  projectId: string
  title: string
}

export interface Decision {
  id: string
  projectId: string
  title: string
  body: string
  createdAt: string
}

export interface Note {
  id: string
  projectId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface EnvVar {
  id: string
  projectId: string
  key: string
  value: string
  secret: boolean
}
