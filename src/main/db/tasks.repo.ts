import { nanoid } from 'nanoid'
import { getDb } from './database'
import type { Task, CreateTaskInput } from '@shared/project.types'

function rowToTask(row: any): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listTasks(projectId: string): Task[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC')
    .all(projectId)
  return rows.map(rowToTask)
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDb()
  const id = nanoid()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO tasks (id, project_id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.projectId, input.title, now, now)

  return rowToTask(
    db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  )
}

export function toggleTask(id: string): Task | null {
  const db = getDb()
  const now = new Date().toISOString()

  db.prepare(
    `UPDATE tasks SET completed = NOT completed, updated_at = ? WHERE id = ?`
  ).run(now, id)

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  return row ? rowToTask(row) : null
}

export function updateTask(id: string, title: string): Task | null {
  const db = getDb()
  const now = new Date().toISOString()

  db.prepare('UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?').run(
    title,
    now,
    id
  )

  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  return row ? rowToTask(row) : null
}

export function deleteTask(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return result.changes > 0
}
