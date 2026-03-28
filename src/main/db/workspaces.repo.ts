import { nanoid } from 'nanoid'
import { getDb } from './database'
import type {
  Workspace,
  CreateWorkspaceInput,
  WorkspaceLayoutState
} from '@shared/workspace.types'

function rowToWorkspace(row: any): Workspace {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    layoutState: JSON.parse(row.layout_state) as WorkspaceLayoutState,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listWorkspaces(projectId: string): Workspace[] {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT * FROM workspaces WHERE project_id = ? AND archived = 0 ORDER BY created_at ASC'
    )
    .all(projectId)
  return rows.map(rowToWorkspace)
}

export function createWorkspace(input: CreateWorkspaceInput): Workspace {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()
  const defaultLayout: WorkspaceLayoutState = { panels: [], sizes: [] }

  db.prepare(
    `INSERT INTO workspaces (id, project_id, name, layout_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, input.projectId, input.name, JSON.stringify(defaultLayout), now, now)

  return rowToWorkspace(
    db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id)
  )
}

export function archiveWorkspace(id: string): boolean {
  const db = getDb()
  const now = new Date().toISOString()
  const result = db
    .prepare('UPDATE workspaces SET archived = 1, updated_at = ? WHERE id = ?')
    .run(now, id)
  return result.changes > 0
}

export function deleteWorkspace(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  return result.changes > 0
}
