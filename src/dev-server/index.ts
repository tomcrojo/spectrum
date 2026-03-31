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
import { execFileSync } from 'child_process'
import http from 'node:http'
import { join } from 'path'
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { nanoid } from 'nanoid'
import * as pty from 'node-pty'
import {
  ensureRuntime,
  ensureT3Project,
  ensurePanelThread,
  getThreadInfo,
  getT3CodeLastUserMessageAt,
  unwatchThread,
  watchThread,
  stopAllT3Code
} from '../main/t3code/T3CodeManager'
import { BROWSER_CHANNELS, T3CODE_CHANNELS } from '../shared/ipc-channels'
import { getRandomProjectColor, normalizeProjectColor } from '@shared/project.types'

// ─── Database Setup ────────────────────────────────────────────────────

const dataDir = join(homedir(), '.spectrum-dev')
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

const dbPath = join(dataDir, 'spectrum-dev.db')
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
    color: normalizeProjectColor(row.color),
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
    updatedAt: row.updated_at,
    lastPanelEditedAt: row.last_panel_edited_at ?? null
  }
}

function sanitizeLayoutStateForNewWorkspace(layoutState: any) {
  if (!layoutState || typeof layoutState !== 'object') {
    return { panels: [], sizes: [] }
  }

  const panels = Array.isArray(layoutState.panels)
    ? layoutState.panels.map((panel: any) => ({
        ...panel,
        t3ProjectId: undefined,
        t3ThreadId: undefined
      }))
    : []

  const sizes = Array.isArray(layoutState.sizes) ? layoutState.sizes : []

  return {
    ...layoutState,
    panels,
    sizes
  }
}

function getNewerTimestamp(left: string | null | undefined, right: string | null | undefined) {
  const leftValue = left ? new Date(left).getTime() : Number.NaN
  const rightValue = right ? new Date(right).getTime() : Number.NaN

  if (Number.isNaN(leftValue)) {
    return Number.isNaN(rightValue) ? null : right ?? null
  }

  if (Number.isNaN(rightValue) || leftValue >= rightValue) {
    return left ?? null
  }

  return right ?? null
}

function getLatestT3CodePanelActivityAt(layoutState: any, projectPath: string) {
  return (layoutState.panels as Array<{ id: string; type: string }>).reduce<string | null>(
    (latestTimestamp, panel) => {
      if (panel.type !== 't3code') {
        return latestTimestamp
      }

      return getNewerTimestamp(
        latestTimestamp,
        getT3CodeLastUserMessageAt(panel.id, projectPath)
      )
    },
    null
  )
}

function backfillWorkspaceLastPanelEditedAt(row: any) {
  const layoutState = JSON.parse(row.layout_state)
  const nextTimestamp = getNewerTimestamp(
    row.last_panel_edited_at ?? null,
    getLatestT3CodePanelActivityAt(layoutState, row.repo_path)
  )

  if (!nextTimestamp || nextTimestamp === row.last_panel_edited_at) {
    return row
  }

  db.prepare('UPDATE workspaces SET last_panel_edited_at = ? WHERE id = ?').run(nextTimestamp, row.id)

  return {
    ...row,
    last_panel_edited_at: nextTimestamp
  }
}

function listWorkspacesForProject(args: string | { projectId: string; includeArchived?: boolean }) {
  const projectId = typeof args === 'string' ? args : args.projectId
  const includeArchived = typeof args === 'string' ? false : Boolean(args.includeArchived)

  return db
    .prepare(
      includeArchived
        ? `SELECT w.*, p.repo_path
           FROM workspaces w
           INNER JOIN projects p ON p.id = w.project_id
           WHERE w.project_id = ?
           ORDER BY w.archived ASC, w.created_at ASC`
        : `SELECT w.*, p.repo_path
           FROM workspaces w
           INNER JOIN projects p ON p.id = w.project_id
           WHERE w.project_id = ? AND w.archived = 0
           ORDER BY w.created_at ASC`
    )
    .all(projectId)
    .map(backfillWorkspaceLastPanelEditedAt)
    .map(rowToWorkspace)
}

// ─── PTY Manager ──────────────────────────────────────────────────────

interface PtyInstance {
  pty: pty.IPty
  projectId: string
  workspaceId: string
  ws: WebSocket
  browserApiToken: string
}

const ptys = new Map<string, PtyInstance>()
const wsClients = new Set<WebSocket>()

interface BrowserPanelState {
  panelId: string
  workspaceId: string
  projectId: string
  url: string
  panelTitle: string
  width?: number
  height?: number
}

const browserPanels = new Map<string, BrowserPanelState>()
const browserTokens = new Map<string, { workspaceId: string; projectId: string }>()
let browserApiServer: http.Server | null = null
let browserApiPort: number | null = null

function getShell(): string {
  if (process.platform === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/zsh'
}

function getBrowserCliBinDir(): string {
  return join(process.cwd(), 'resources', 'browser-cli', 'bin')
}

function prependBrowserCliToPath(existingPath: string | undefined): string {
  const binDir = getBrowserCliBinDir()
  if (!existingPath) {
    return binDir
  }

  return [binDir, ...existingPath.split(':').filter(Boolean)].join(':')
}

function getBrowserCommandPath(): string {
  if (process.platform === 'win32') {
    return join(getBrowserCliBinDir(), 'browser.js')
  }

  return join(getBrowserCliBinDir(), 'browser')
}

function getBrowserCliCommandPath(): string {
  if (process.platform === 'win32') {
    return join(getBrowserCliBinDir(), 'browser-cli.js')
  }

  return join(getBrowserCliBinDir(), 'browser-cli')
}

function getBrowserCliSessionFilePath(): string {
  return join(dataDir, 'browser-cli', 'sessions.json')
}

function registerBrowserToken(token: string, workspaceId: string, projectId: string): void {
  browserTokens.set(token, { workspaceId, projectId })
}

function revokeBrowserToken(token: string): void {
  browserTokens.delete(token)
}

function pushBrowserEvent(channel: string, payload: unknown): void {
  const message = JSON.stringify({
    type: channel,
    payload
  })

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  }
}

function readRequestBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function startBrowserApiServer(): Promise<number> {
  if (browserApiServer && browserApiPort !== null) {
    return Promise.resolve(browserApiPort)
  }

  browserApiServer = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    let body: any
    try {
      body = await readRequestBody(req)
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid body' })
      return
    }

    const token = typeof body.token === 'string' ? body.token : ''
    const scope = browserTokens.get(token)
    if (!scope) {
      sendJson(res, 401, { error: 'Invalid token' })
      return
    }

    if (req.url === '/browser/open') {
      const panel: BrowserPanelState = {
        panelId: nanoid(),
        workspaceId: scope.workspaceId,
        projectId: scope.projectId,
        url: typeof body.url === 'string' ? body.url : 'about:blank',
        panelTitle: 'Browser',
        width: typeof body.width === 'number' ? body.width : undefined,
        height: typeof body.height === 'number' ? body.height : undefined
      }
      browserPanels.set(panel.panelId, panel)
      pushBrowserEvent(BROWSER_CHANNELS.OPEN, panel)
      sendJson(res, 200, { panelId: panel.panelId })
      return
    }

    if (req.url === '/browser/navigate') {
      const panelId = typeof body.panelId === 'string' ? body.panelId : ''
      const url = typeof body.url === 'string' ? body.url : ''
      const panel = browserPanels.get(panelId)
      if (!panel || panel.workspaceId !== scope.workspaceId) {
        sendJson(res, 404, { error: 'Panel not found' })
        return
      }
      panel.url = url
      pushBrowserEvent(BROWSER_CHANNELS.NAVIGATE, {
        panelId,
        workspaceId: scope.workspaceId,
        url
      })
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.url === '/browser/close') {
      const panelId = typeof body.panelId === 'string' ? body.panelId : ''
      const panel = browserPanels.get(panelId)
      if (!panel || panel.workspaceId !== scope.workspaceId) {
        sendJson(res, 404, { error: 'Panel not found' })
        return
      }
      browserPanels.delete(panelId)
      pushBrowserEvent(BROWSER_CHANNELS.CLOSE, {
        panelId,
        workspaceId: scope.workspaceId
      })
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.url === '/browser/resize') {
      const panelId = typeof body.panelId === 'string' ? body.panelId : ''
      const width = typeof body.width === 'number' ? body.width : Number.NaN
      const height = typeof body.height === 'number' ? body.height : Number.NaN
      const panel = browserPanels.get(panelId)
      if (
        !panel ||
        panel.workspaceId !== scope.workspaceId ||
        Number.isNaN(width) ||
        Number.isNaN(height)
      ) {
        sendJson(res, 404, { error: 'Panel not found' })
        return
      }
      panel.width = width
      panel.height = height
      pushBrowserEvent(BROWSER_CHANNELS.RESIZE, {
        panelId,
        workspaceId: scope.workspaceId,
        width,
        height
      })
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.url === '/browser/list') {
      sendJson(res, 200, {
        panels: Array.from(browserPanels.values()).filter(
          (panel) => panel.workspaceId === scope.workspaceId
        )
      })
      return
    }

    if (req.url === '/browser/cdp-endpoint') {
      sendJson(res, 200, { endpoint: null })
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  })

  return new Promise((resolve, reject) => {
    browserApiServer!.once('error', reject)
    browserApiServer!.listen(0, '127.0.0.1', () => {
      browserApiServer!.removeListener('error', reject)
      const address = browserApiServer!.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start browser API server'))
        return
      }
      browserApiPort = address.port
      resolve(address.port)
    })
  })
}

async function stopBrowserApiServer(): Promise<void> {
  if (!browserApiServer) {
    return
  }

  await new Promise<void>((resolve) => browserApiServer?.close(() => resolve()))
  browserApiServer = null
  browserApiPort = null
}

function selectDirectoryInBrowserMode(): string | null {
  try {
    if (process.platform === 'darwin') {
      const output = execFileSync(
        'osascript',
        [
          '-e',
          'POSIX path of (choose folder with prompt "Select a project folder")'
        ],
        { encoding: 'utf8' }
      )
      const directory = output.trim()
      return directory.length > 0 ? directory.replace(/\/$/, '') : null
    }

    if (process.platform === 'linux') {
      const output = execFileSync(
        'zenity',
        ['--file-selection', '--directory', '--title=Select a project folder'],
        { encoding: 'utf8' }
      )
      const directory = output.trim()
      return directory.length > 0 ? directory : null
    }

    if (process.platform === 'win32') {
      const output = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
        ],
        { encoding: 'utf8' }
      )
      const directory = output.trim()
      return directory.length > 0 ? directory : null
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)
    if (!details.includes('execution error: User canceled')) {
      console.warn(`[dev-server] Failed to open directory picker: ${details}`)
    }
  }

  return null
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
    const color = input.color || getRandomProjectColor()
    db.prepare(
      `INSERT INTO projects (id, name, repo_path, description, color, git_workspaces_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.repoPath,
      input.description || '',
      color,
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

  'workspace:list': (args: string | { projectId: string; includeArchived?: boolean }) => {
    return listWorkspacesForProject(args)
  },

  'workspace:create': (input: any) => {
    const id = nanoid()
    const now = new Date().toISOString()
    const defaultLayout = JSON.stringify(
      input.layoutState
        ? sanitizeLayoutStateForNewWorkspace(input.layoutState)
        : { panels: [], sizes: [] }
    )
    const parsedLayout = JSON.parse(defaultLayout)
    const lastPanelEditedAt = parsedLayout.panels.length > 0 ? now : null
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
    ).run(id, input.projectId, input.name, defaultLayout, now, now, lastPanelEditedAt)
    return rowToWorkspace(
      db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id)
    )
  },

  'workspace:update': (input: any) => {
    const existing = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(input.id)
    if (!existing) return null

    const now = new Date().toISOString()
    const updates: string[] = ['updated_at = ?']
    const values: any[] = [now]

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
  },

  'workspace:update-layout': (input: any) => {
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
  },

  'workspace:update-last-panel-edited-at': (input: { id: string; timestamp: string }) => {
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

  'workspace:unarchive': (id: string) => {
    const now = new Date().toISOString()
    const result = db
      .prepare(
        'UPDATE workspaces SET archived = 0, updated_at = ? WHERE id = ?'
      )
      .run(now, id)
    return result.changes > 0
  },

  'workspace:delete': (id: string) => {
    const result = db.prepare('DELETE FROM workspaces WHERE id = ?').run(id)
    return result.changes > 0
  },

  'dialog:select-directory': () => {
    return selectDirectoryInBrowserMode()
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
    env.PATH = prependBrowserCliToPath(env.PATH)
    env.SPECTRUM_BROWSER = getBrowserCommandPath()
    env.SPECTRUM_BROWSER_CLI = getBrowserCliCommandPath()
    env.SPECTRUM_BROWSER_SESSION_FILE = getBrowserCliSessionFilePath()
    const browserApiToken = nanoid(32)
    registerBrowserToken(browserApiToken, args.workspaceId, args.projectId)
    if (browserApiPort !== null) {
      env.SPECTRUM_API_PORT = String(browserApiPort)
      env.SPECTRUM_API_TOKEN = browserApiToken
      env.SPECTRUM_WORKSPACE_ID = args.workspaceId
      env.SPECTRUM_PROJECT_ID = args.projectId
    }

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
      revokeBrowserToken(browserApiToken)
      ptys.delete(args.id)
    })

    ptys.set(args.id, {
      pty: ptyProcess,
      projectId: args.projectId,
      workspaceId: args.workspaceId,
      ws,
      browserApiToken
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
      revokeBrowserToken(instance.browserApiToken)
      ptys.delete(args.id)
    }
  },

  't3code:start': async (args: {
    instanceId?: string
    workspaceId?: string
    projectId?: string
    projectPath: string
  }) => {
    const resolvedInstanceId = args.instanceId ?? args.workspaceId
    if (!resolvedInstanceId) {
      throw new Error('Missing T3Code panel instance id')
    }

    return ensurePanelThread({
      panelId: resolvedInstanceId,
      spectrumProjectId: args.projectId ?? resolvedInstanceId,
      projectPath: args.projectPath,
      projectName: args.projectPath.split('/').filter(Boolean).at(-1) ?? 'Project'
    })
  },

  't3code:stop': (payload: string | { instanceId?: string; workspaceId?: string }) => {
    const resolvedInstanceId =
      typeof payload === 'string'
        ? payload
        : payload.instanceId ?? payload.workspaceId

    if (!resolvedInstanceId) {
      throw new Error('Missing T3Code panel instance id')
    }

    stopAllT3Code()
  },

  't3code:get-thread-info': (args: {
    t3ThreadId?: string
    instanceId?: string
    workspaceId?: string
  }) => {
    const resolvedThreadId = args.t3ThreadId ?? args.instanceId ?? args.workspaceId
    if (!resolvedThreadId) {
      throw new Error('Missing T3Code thread id')
    }

    return getThreadInfo(resolvedThreadId)
  },

  [T3CODE_CHANNELS.ENSURE_RUNTIME]: () => ensureRuntime(),

  [T3CODE_CHANNELS.ENSURE_PROJECT]: (args: {
    spectrumProjectId: string
    projectPath: string
    projectName: string
    existingT3ProjectId?: string
  }) =>
    ensureT3Project({
      spectrumProjectId: args.spectrumProjectId,
      projectPath: args.projectPath,
      projectName: args.projectName,
      existingT3ProjectId: args.existingT3ProjectId
    }),

  [T3CODE_CHANNELS.ENSURE_PANEL_THREAD]: (args: {
    panelId: string
    spectrumProjectId: string
    projectPath: string
    projectName: string
    existingT3ProjectId?: string
    existingT3ThreadId?: string
  }) =>
    ensurePanelThread({
      panelId: args.panelId,
      spectrumProjectId: args.spectrumProjectId,
      projectPath: args.projectPath,
      projectName: args.projectName,
      existingT3ProjectId: args.existingT3ProjectId,
      existingT3ThreadId: args.existingT3ThreadId
    }),

  [T3CODE_CHANNELS.GET_THREAD_INFO]: (args: { t3ThreadId: string }) => getThreadInfo(args.t3ThreadId),

  [T3CODE_CHANNELS.WATCH_THREAD]: (args: {
    panelId: string
    t3ThreadId: string
    priority: 'focused' | 'active' | 'inactive'
  }) =>
    watchThread({
      panelId: args.panelId,
      t3ThreadId: args.t3ThreadId,
      priority: args.priority
    }),

  [T3CODE_CHANNELS.UNWATCH_THREAD]: (args: { panelId: string }) => unwatchThread(args.panelId),

  [BROWSER_CHANNELS.WEBVIEW_READY]: () => true,

  [BROWSER_CHANNELS.WEBVIEW_DESTROYED]: () => true,

  [BROWSER_CHANNELS.URL_CHANGED]: (payload: {
    panelId: string
    url?: string
    panelTitle?: string
  }) => {
    const panel = browserPanels.get(payload.panelId)
    if (!panel) {
      return false
    }
    if (typeof payload.url === 'string') {
      panel.url = payload.url
    }
    if (typeof payload.panelTitle === 'string' && payload.panelTitle.trim().length > 0) {
      panel.panelTitle = payload.panelTitle.trim()
    }
    return true
  }
}

// ─── WebSocket Server ─────────────────────────────────────────────────

const PORT = 3001
const wss = new WebSocketServer({ port: PORT })
void startBrowserApiServer()
  .then((port) => {
    console.log(`     Browser API: http://127.0.0.1:${port}`)
  })
  .catch((error) => {
    console.error('[dev-server] Failed to start browser API server:', error)
  })

wss.on('connection', (ws) => {
  console.log('Client connected')
  wsClients.add(ws)

  ws.on('message', async (raw) => {
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
        const result = await Promise.resolve(handler(args, ws))
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
    wsClients.delete(ws)
    // Clean up PTYs owned by this connection
    for (const [id, instance] of ptys) {
      if (instance.ws === ws) {
        instance.pty.kill()
        revokeBrowserToken(instance.browserApiToken)
        ptys.delete(id)
      }
    }
  })
})

console.log(`\n  🐛 Spectrum dev server running on ws://localhost:${PORT}`)
console.log(`     Database: ${dbPath}`)
console.log(`     Open http://localhost:5173 in your browser\n`)

// Cleanup on exit
process.on('SIGINT', () => {
  for (const [, instance] of ptys) {
    instance.pty.kill()
    revokeBrowserToken(instance.browserApiToken)
  }
  stopAllT3Code()
  void stopBrowserApiServer()
  db.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  for (const [, instance] of ptys) {
    instance.pty.kill()
    revokeBrowserToken(instance.browserApiToken)
  }
  stopAllT3Code()
  void stopBrowserApiServer()
  db.close()
  process.exit(0)
})
