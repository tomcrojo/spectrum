/**
 * Dev server — standalone Node.js process that provides the same backend
 * as the Electron main process, but over WebSocket instead of IPC.
 *
 * This lets us test the full app (including terminals) in a regular browser
 * via dev-browser, without needing to launch Electron.
 *
 * Usage: npx tsx src/dev-server/index.ts
 */

import { WebSocketServer, WebSocket } from 'ws'
import Database from 'better-sqlite3'
import { join } from 'path'
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { nanoid } from 'nanoid'
import * as pty from 'node-pty'

// ─── Database Setup ────────────────────────────────────────────────────

const dataDir = join(homedir(), '.centipede-dev')
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

const dbPath = join(dataDir, 'centipede-dev.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Run migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

const migrationsDir = join(__dirname, '..', 'main', 'db', 'migrations')
const srcMigrationsDir = join(
  process.cwd(),
  'src',
  'main',
  'db',
  'migrations'
)
const mDir = existsSync(migrationsDir) ? migrationsDir : srcMigrationsDir

if (existsSync(mDir)) {
  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r: any) => r.name)
  )
  const files = readdirSync(mDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(mDir, file), 'utf-8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    console.log(`Applied migration: ${file}`)
  }
}

// ─── Repo helpers (inline, avoid importing Electron-dependent code) ─────

function rowToProject(row: any) {
  return {
    id: row.id,
    name: row.name,
    repoPath: row.repo_path,
    description: row.description,
    progress: row.progress,
    gitWorkspacesEnabled: Boolean(row.git_workspaces_enabled),
    defaultBrowserCookiePolicy: row.default_browser_cookie_policy,
    defaultTerminalMode: row.default_terminal_mode,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToTask(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function rowToWorkspace(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    layoutState: JSON.parse(row.layout_state),
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// ─── PTY Manager ──────────────────────────────────────────────────────

interface PtyInstance {
  pty: pty.IPty
  projectId: string
  workspaceId: string
  ws: WebSocket
}

const ptys = new Map<string, PtyInstance>()

function getShell(): string {
  if (process.platform === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/zsh'
}

// ─── IPC Handler Map ──────────────────────────────────────────────────

type Handler = (args: any, ws: WebSocket) => any

const handlers: Record<string, Handler> = {
  'project:list': () => {
    return db
      .prepare(
        'SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC'
      )
      .all()
      .map(rowToProject)
  },

  'project:get': (id: string) => {
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
    return row ? rowToProject(row) : null
  },

  'project:create': (input: any) => {
    const id = nanoid()
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO projects (id, name, repo_path, description, git_workspaces_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.repoPath,
      input.description || '',
      input.gitWorkspacesEnabled ? 1 : 0,
      now,
      now
    )
    return rowToProject(
      db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
    )
  },

  'project:update': (input: any) => {
    const existing = db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(input.id)
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
    return rowToProject(
      db.prepare('SELECT * FROM projects WHERE id = ?').get(input.id)
    )
  },

  'project:delete': (id: string) => {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    return result.changes > 0
  },

  'task:list': (projectId: string) => {
    return db
      .prepare(
        'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC'
      )
      .all(projectId)
      .map(rowToTask)
  },

  'task:create': (input: any) => {
    const id = nanoid()
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO tasks (id, project_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.projectId, input.title, now, now)
    return rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id))
  },

  'task:toggle': (id: string) => {
    const now = new Date().toISOString()
    db.prepare(
      `UPDATE tasks SET completed = NOT completed, updated_at = ? WHERE id = ?`
    ).run(now, id)
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    return row ? rowToTask(row) : null
  },

  'task:update': (args: any) => {
    // args = [id, title]
    const [id, title] = Array.isArray(args) ? args : [args.id, args.title]
    const now = new Date().toISOString()
    db.prepare('UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?').run(
      title,
      now,
      id
    )
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
    return row ? rowToTask(row) : null
  },

  'task:delete': (id: string) => {
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    return result.changes > 0
  },

  'workspace:list': (projectId: string) => {
    return db
      .prepare(
        'SELECT * FROM workspaces WHERE project_id = ? AND archived = 0 ORDER BY created_at ASC'
      )
      .all(projectId)
      .map(rowToWorkspace)
  },

  'workspace:create': (input: any) => {
    const id = nanoid()
    const now = new Date().toISOString()
    const defaultLayout = JSON.stringify({ panels: [], sizes: [] })
    db.prepare(
      `INSERT INTO workspaces (id, project_id, name, layout_state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.projectId, input.name, defaultLayout, now, now)
    return rowToWorkspace(
      db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id)
    )
  },

  'workspace:archive': (id: string) => {
    const now = new Date().toISOString()
    const result = db
      .prepare(
        'UPDATE workspaces SET archived = 1, updated_at = ? WHERE id = ?'
      )
      .run(now, id)
    return result.changes > 0
  },

  'workspace:delete': (id: string) => {
    const result = db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
    return result.changes > 0
  },

  'dialog:select-directory': () => {
    // In browser mode, we just return the cwd
    return process.cwd()
  },

  'terminal:create': (
    args: { id: string; cwd: string; projectId: string; workspaceId: string },
    ws: WebSocket
  ) => {
    const shell = getShell()
    const safeCwd = existsSync(args.cwd) ? args.cwd : homedir()

    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') {
        env[k] = v
      }
    }
    env.TERM = 'xterm-256color'
    env.COLORTERM = 'truecolor'

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: safeCwd,
      env
    })

    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'terminal:data',
            id: args.id,
            data
          })
        )
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'terminal:exit',
            id: args.id,
            exitCode
          })
        )
      }
      ptys.delete(args.id)
    })

    ptys.set(args.id, {
      pty: ptyProcess,
      projectId: args.projectId,
      workspaceId: args.workspaceId,
      ws
    })

    return { id: args.id, pid: ptyProcess.pid }
  },

  'terminal:write': (args: { id: string; data: string }) => {
    const instance = ptys.get(args.id)
    if (instance) instance.pty.write(args.data)
  },

  'terminal:resize': (args: { id: string; cols: number; rows: number }) => {
    const instance = ptys.get(args.id)
    if (instance) instance.pty.resize(args.cols, args.rows)
  },

  'terminal:close': (args: { id: string }) => {
    const instance = ptys.get(args.id)
    if (instance) {
      instance.pty.kill()
      ptys.delete(args.id)
    }
  }
}

// ─── WebSocket Server ─────────────────────────────────────────────────

const PORT = 3001
const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (ws) => {
  console.log('Client connected')

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      const { id, channel, args } = msg

      const handler = handlers[channel]
      if (!handler) {
        ws.send(
          JSON.stringify({
            id,
            error: `No handler for channel: ${channel}`
          })
        )
        return
      }

      try {
        const result = handler(args, ws)
        ws.send(JSON.stringify({ id, result }))
      } catch (err: any) {
        ws.send(JSON.stringify({ id, error: err.message }))
      }
    } catch {
      console.error('Invalid message:', raw.toString().slice(0, 200))
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected')
    // Clean up PTYs owned by this connection
    for (const [id, instance] of ptys) {
      if (instance.ws === ws) {
        instance.pty.kill()
        ptys.delete(id)
      }
    }
  })
})

console.log(`\n  🐛 Centipede dev server running on ws://localhost:${PORT}`)
console.log(`     Database: ${dbPath}`)
console.log(`     Open http://localhost:5173 in your browser\n`)

// Cleanup on exit
process.on('SIGINT', () => {
  for (const [, instance] of ptys) {
    instance.pty.kill()
  }
  db.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  for (const [, instance] of ptys) {
    instance.pty.kill()
  }
  db.close()
  process.exit(0)
})
