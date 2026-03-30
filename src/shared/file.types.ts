export interface FileTreeNode {
  name: string
  path: string
  relativePath: string
  kind: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface ReadFileInput {
  projectId: string
  path: string
}

export interface ReadFileResult {
  path: string
  relativePath: string
  content: string
  language: string | null
  mtimeMs: number
}

export interface WriteFileInput {
  projectId: string
  path: string
  content: string
  expectedMtimeMs: number
}

export interface WriteFileResult {
  path: string
  mtimeMs: number
}

export interface StatFileInput {
  projectId: string
  path: string
}

export interface StatFileResult {
  path: string
  exists: boolean
  kind: 'file' | 'directory' | null
  mtimeMs: number | null
}

export interface OpenFileInPanelInput {
  projectId: string
  workspaceId: string
  path: string
  line?: number
  column?: number
  source?: 't3code' | 'app' | 'browser'
}

export interface OpenFileInPanelResult {
  projectId: string
  workspaceId: string
  path: string
  relativePath: string
  line: number
  column: number
  source?: 't3code' | 'app' | 'browser'
}
