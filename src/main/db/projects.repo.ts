import { nanoid } from 'nanoid'
import { getDb } from './database'
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput
} from '@shared/project.types'
import { getRandomProjectColor, normalizeProjectColor } from '@shared/project.types'

function rowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    repoPath: row.repo_path,
    description: row.description,
    progress: row.progress as 0 | 1 | 2 | 3,
    color: normalizeProjectColor(row.color),
    gitWorkspacesEnabled: Boolean(row.git_workspaces_enabled),
    defaultBrowserCookiePolicy: row.default_browser_cookie_policy,
    defaultTerminalMode: row.default_terminal_mode,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listProjects(): Project[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC')
    .all()
  return rows.map(rowToProject)
}

export function getProject(id: string): Project | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  return row ? rowToProject(row) : null
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()
  const color = input.color || getRandomProjectColor()

  db.prepare(
    `INSERT INTO projects (id, name, repo_path, description, color, git_workspaces_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.name, input.repoPath, input.description || '', color, input.gitWorkspacesEnabled ? 1 : 0, now, now)

  return getProject(id)!
}

export function updateProject(input: UpdateProjectInput): Project | null {
  const db = getDb()
  const existing = getProject(input.id)
  if (!existing) return null

  const now = new Date().toISOString()
  const updates: string[] = ['updated_at = ?']
  const values: any[] = [now]

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }
  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description)
  }
  if (input.progress !== undefined) {
    updates.push('progress = ?')
    values.push(input.progress)
  }
  if (input.color !== undefined) {
    updates.push('color = ?')
    values.push(input.color)
  }
  if (input.gitWorkspacesEnabled !== undefined) {
    updates.push('git_workspaces_enabled = ?')
    values.push(input.gitWorkspacesEnabled ? 1 : 0)
  }
  if (input.defaultBrowserCookiePolicy !== undefined) {
    updates.push('default_browser_cookie_policy = ?')
    values.push(input.defaultBrowserCookiePolicy)
  }
  if (input.defaultTerminalMode !== undefined) {
    updates.push('default_terminal_mode = ?')
    values.push(input.defaultTerminalMode)
  }
  if (input.archived !== undefined) {
    updates.push('archived = ?')
    values.push(input.archived ? 1 : 0)
  }

  values.push(input.id)
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(
    ...values
  )

  return getProject(input.id)
}

export function deleteProject(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  return result.changes > 0
}
