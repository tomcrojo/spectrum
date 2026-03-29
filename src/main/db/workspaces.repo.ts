import { nanoid } from 'nanoid'
import { getDb } from './database'
import type {
  Workspace,
  CreateWorkspaceInput,
  ListWorkspacesInput,
  WorkspaceLayoutState,
  UpdateWorkspaceInput,
  UpdateWorkspaceLayoutInput,
  UpdateWorkspaceLastPanelEditedAtInput
} from '@shared/workspace.types'

function rowToWorkspace(row: any): Workspace {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    layoutState: JSON.parse(row.layout_state) as WorkspaceLayoutState,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastPanelEditedAt: row.last_panel_edited_at ?? null
  }
}

export function listWorkspaces(input: string | ListWorkspacesInput): Workspace[] {
  const db = getDb()
  const projectId = typeof input === 'string' ? input : input.projectId
  const includeArchived =
    typeof input === 'string' ? false : Boolean(input.includeArchived)
  const rows = db
    .prepare(
      includeArchived
        ? 'SELECT * FROM workspaces WHERE project_id = ? ORDER BY archived ASC, created_at ASC'
        : 'SELECT * FROM workspaces WHERE project_id = ? AND archived = 0 ORDER BY created_at ASC'
    )
    .all(projectId)
  return rows.map(rowToWorkspace)
}

export function createWorkspace(input: CreateWorkspaceInput): Workspace {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()
  const defaultLayout: WorkspaceLayoutState = input.layoutState ?? { panels: [], sizes: [] }
  const lastPanelEditedAt = defaultLayout.panels.length > 0 ? now : null

  db.prepare(
    `INSERT INTO workspaces (
      id,
      project_id,
      name,
      layout_state,
      created_at,
      updated_at,
      last_panel_edited_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.projectId,
    input.name,
    JSON.stringify(defaultLayout),
    now,
    now,
    lastPanelEditedAt
  )

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

export function updateWorkspace(input: UpdateWorkspaceInput): Workspace | null {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(input.id)
  if (!existing) {
    return null
  }

  const now = new Date().toISOString()
  const updates: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }

  if (input.archived !== undefined) {
    updates.push('archived = ?')
    values.push(input.archived ? 1 : 0)
  }

  if (updates.length === 1) {
    return rowToWorkspace(existing)
  }

  values.push(input.id)

  const result = db
    .prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values)

  if (result.changes === 0) {
    return null
  }

  return rowToWorkspace(
    db.prepare('SELECT * FROM workspaces WHERE id = ?').get(input.id)
  )
}

export function updateWorkspaceLayout(input: UpdateWorkspaceLayoutInput): Workspace | null {
  const db = getDb()
  const now = new Date().toISOString()
  const result = db
    .prepare(
      'UPDATE workspaces SET layout_state = ?, updated_at = ?, last_panel_edited_at = ? WHERE id = ?'
    )
    .run(JSON.stringify(input.layoutState), now, now, input.id)
  if (result.changes === 0) {
    return null
  }

  return rowToWorkspace(
    db.prepare('SELECT * FROM workspaces WHERE id = ?').get(input.id)
  )
}

export function updateWorkspaceLastPanelEditedAt(
  input: UpdateWorkspaceLastPanelEditedAtInput
): Workspace | null {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(input.id)
  if (!existing) {
    return null
  }

  const nextTimestamp = new Date(input.timestamp)
  if (Number.isNaN(nextTimestamp.getTime())) {
    return rowToWorkspace(existing)
  }

  const currentTimestamp = existing.last_panel_edited_at
    ? new Date(existing.last_panel_edited_at)
    : null

  if (
    currentTimestamp &&
    !Number.isNaN(currentTimestamp.getTime()) &&
    currentTimestamp.getTime() >= nextTimestamp.getTime()
  ) {
    return rowToWorkspace(existing)
  }

  const result = db
    .prepare('UPDATE workspaces SET last_panel_edited_at = ? WHERE id = ?')
    .run(input.timestamp, input.id)

  if (result.changes === 0) {
    return null
  }

  return rowToWorkspace(
    db.prepare('SELECT * FROM workspaces WHERE id = ?').get(input.id)
  )
}

export function unarchiveWorkspace(id: string): boolean {
  const db = getDb()
  const now = new Date().toISOString()
  const result = db
    .prepare('UPDATE workspaces SET archived = 0, updated_at = ? WHERE id = ?')
    .run(now, id)
  return result.changes > 0
}
