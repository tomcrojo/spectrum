import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync, openSync, closeSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import net from 'net'
import Database from 'better-sqlite3'
import WebSocket from 'ws'
import { BrowserWindow } from 'electron'
import { T3CODE_CHANNELS } from '@shared/ipc-channels'
import { getT3CodeConfig } from './config'
import {
  getBrowserCliCommandPath,
  getBrowserCommandPath,
  getBrowserCliSessionFilePath,
  prependBrowserCliToPath
} from '../browser-cli/BrowserCliPathManager'

interface RuntimeInstance {
  process: ChildProcess
  baseUrl: string
  logPath: string
  stateDir: string
}

interface ProjectRow {
  projectId: string
  title: string
  workspaceRoot: string
  defaultModelSelectionJson: string | null
}

interface ThreadRow {
  threadId: string
  projectId: string
  title: string
  modelSelectionJson: string
  deletedAt: string | null
}

interface ThreadMetadata {
  threadTitle: string | null
  lastUserMessageAt: string | null
}

interface WatchedThreadState {
  panelId: string
  t3ThreadId: string
  priority: 'focused' | 'active' | 'inactive'
  lastPolledAt: number
  lastSnapshot: ThreadMetadata | null
}

export interface T3CodeThreadInfo {
  url: string | null
  threadTitle: string | null
  lastUserMessageAt: string | null
}

const GLOBAL_RUNTIME_ID = 'global'
const DEFAULT_MODEL_SELECTION = {
  provider: 'codex',
  model: 'gpt-5.4'
} as const

let runtime: RuntimeInstance | null = null
let pendingRuntimeStart: Promise<{ baseUrl: string; logPath: string }> | null = null
const pendingProjectEnsures = new Map<string, Promise<{ t3ProjectId: string }>>()
const pendingPanelThreadEnsures = new Map<
  string,
  Promise<{
    baseUrl: string
    t3ProjectId: string
    t3ThreadId: string
    threadTitle: string | null
    lastUserMessageAt: string | null
  }>
>()
const watchedThreadsByPanelId = new Map<string, WatchedThreadState>()
let watchTimer: NodeJS.Timeout | null = null

function reserveLoopbackPort(): Promise<number> {
  const server = net.createServer()

  return new Promise<number>((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Failed to reserve loopback port'))
        return
      }

      const port = address.port
      server.close(() => resolve(port))
    })
  })
}

function getFreePort(): Promise<number> {
  return reserveLoopbackPort()
}

function getLatestModifiedTime(targetPath: string): number {
  if (!existsSync(targetPath)) {
    return 0
  }

  const stats = statSync(targetPath)
  if (!stats.isDirectory()) {
    return stats.mtimeMs
  }

  let latest = stats.mtimeMs

  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue
    }

    latest = Math.max(latest, getLatestModifiedTime(join(targetPath, entry.name)))
  }

  return latest
}

function shouldRebuild(sourcePath: string, entrypointPath: string): boolean {
  if (!existsSync(entrypointPath)) {
    return true
  }

  const webDistPath = join(sourcePath, 'apps', 'web', 'dist', 'index.html')
  if (!existsSync(webDistPath)) {
    return true
  }

  const latestSourceChange = Math.max(
    getLatestModifiedTime(join(sourcePath, 'package.json')),
    getLatestModifiedTime(join(sourcePath, 'apps', 'web', 'src')),
    getLatestModifiedTime(join(sourcePath, 'apps', 'web', 'index.html')),
    getLatestModifiedTime(join(sourcePath, 'apps', 'server', 'src'))
  )

  const latestBuildOutput = Math.min(
    statSync(entrypointPath).mtimeMs,
    statSync(webDistPath).mtimeMs
  )

  return latestSourceChange > latestBuildOutput
}

function ensureBuilt(sourcePath: string, installCommand: string, buildCommand: string): void {
  const entrypointPath = join(sourcePath, getT3CodeConfig().entrypoint)
  if (!shouldRebuild(sourcePath, entrypointPath)) {
    return
  }

  const install = spawnSync('/bin/zsh', ['-lc', installCommand], {
    cwd: sourcePath,
    stdio: 'inherit'
  })
  if (install.status !== 0) {
    throw new Error('Failed to install T3Code dependencies')
  }

  const build = spawnSync('/bin/zsh', ['-lc', buildCommand], {
    cwd: sourcePath,
    stdio: 'inherit'
  })
  if (build.status !== 0) {
    throw new Error('Failed to build T3Code')
  }
}

async function waitForReady(baseUrl: string, timeoutMs = 30000): Promise<void> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/global/health`)
      if (response.ok) {
        return
      }
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error('Timed out waiting for T3Code to become ready')
}

async function waitForAppShell(baseUrl: string, timeoutMs = 30000): Promise<void> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) {
        return
      }
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Timed out waiting for T3Code app shell')
}

async function waitForWebSocketReady(baseUrl: string, timeoutMs = 10000): Promise<void> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    try {
      await sendWsRequest(baseUrl, { _tag: 'orchestration.getSnapshot' })
      return
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error('Timed out waiting for T3Code websocket readiness')
}

function getStateDir(): string {
  return join(homedir(), '.centipede-dev', 't3code-state', GLOBAL_RUNTIME_ID)
}

function getLogPath(): string {
  const logsDir = join(homedir(), '.centipede-dev', 't3code-logs')
  mkdirSync(logsDir, { recursive: true })
  return join(logsDir, `${GLOBAL_RUNTIME_ID}.log`)
}

function getStateDbPath(stateDir = getStateDir()): string {
  return join(stateDir, 'userdata', 'state.sqlite')
}

function openStateDb(options?: Database.Options): Database.Database | null {
  const stateDbPath = getStateDbPath()
  if (!existsSync(stateDbPath)) {
    return null
  }

  return new Database(stateDbPath, options)
}

function getProjectBindingId(centipedeProjectId: string): string {
  return `centipede-project:${centipedeProjectId}`
}

function parseModelSelection(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) {
    return DEFAULT_MODEL_SELECTION
  }

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fallback
  }

  return DEFAULT_MODEL_SELECTION
}

function getProjectById(projectId: string): ProjectRow | null {
  const db = openStateDb({ readonly: true })
  if (!db) {
    return null
  }

  try {
    return (
      (db
        .prepare(
          `SELECT
             project_id AS projectId,
             title,
             workspace_root AS workspaceRoot,
             default_model_selection_json AS defaultModelSelectionJson
           FROM projection_projects
           WHERE project_id = ?
             AND deleted_at IS NULL`
        )
        .get(projectId) as ProjectRow | undefined) ?? null
    )
  } finally {
    db.close()
  }
}

function getThreadById(threadId: string): ThreadRow | null {
  const db = openStateDb({ readonly: true })
  if (!db) {
    return null
  }

  try {
    return (
      (db
        .prepare(
          `SELECT
             thread_id AS threadId,
             project_id AS projectId,
             title,
             model_selection_json AS modelSelectionJson,
             deleted_at AS deletedAt
           FROM projection_threads
           WHERE thread_id = ?`
        )
        .get(threadId) as ThreadRow | undefined) ?? null
    )
  } finally {
    db.close()
  }
}

function getThreadMetadata(threadId: string): ThreadMetadata {
  const db = openStateDb({ readonly: true })
  if (!db) {
    return {
      threadTitle: null,
      lastUserMessageAt: null
    }
  }

  try {
    const threadRow = db
      .prepare(
        `SELECT title
         FROM projection_threads
         WHERE thread_id = ?
           AND deleted_at IS NULL`
      )
      .get(threadId) as { title?: string } | undefined

    const messageRow = db
      .prepare(
        `SELECT created_at AS lastUserMessageAt
         FROM projection_thread_messages
         WHERE thread_id = ?
           AND role = 'user'
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(threadId) as { lastUserMessageAt?: string } | undefined

    return {
      threadTitle: threadRow?.title ?? null,
      lastUserMessageAt: messageRow?.lastUserMessageAt ?? null
    }
  } finally {
    db.close()
  }
}

function emitThreadInfoChanged(payload: {
  panelId: string
  t3ThreadId: string
  threadTitle: string | null
  lastUserMessageAt: string | null
}): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(T3CODE_CHANNELS.THREAD_INFO_CHANGED, payload)
    }
  }
}

function isAppInteractive(): boolean {
  return BrowserWindow.getAllWindows().some((window) => window.isVisible() && window.isFocused())
}

function getWatchIntervalMs(priority: WatchedThreadState['priority']): number {
  if (priority === 'focused') {
    return 2000
  }

  if (priority === 'active') {
    return 10000
  }

  return 30000
}

async function pollWatchedThreads(): Promise<void> {
  const now = Date.now()
  const appInteractive = isAppInteractive()

  for (const watch of watchedThreadsByPanelId.values()) {
    if (watch.priority === 'inactive' && !appInteractive) {
      continue
    }

    const intervalMs = getWatchIntervalMs(watch.priority)
    if (now - watch.lastPolledAt < intervalMs) {
      continue
    }

    watch.lastPolledAt = now
    const snapshot = getThreadMetadata(watch.t3ThreadId)
    if (
      watch.lastSnapshot?.threadTitle === snapshot.threadTitle &&
      watch.lastSnapshot?.lastUserMessageAt === snapshot.lastUserMessageAt
    ) {
      continue
    }

    watch.lastSnapshot = snapshot
    emitThreadInfoChanged({
      panelId: watch.panelId,
      t3ThreadId: watch.t3ThreadId,
      threadTitle: snapshot.threadTitle,
      lastUserMessageAt: snapshot.lastUserMessageAt
    })
  }
}

function ensureWatchTimer(): void {
  if (watchTimer || watchedThreadsByPanelId.size === 0) {
    return
  }

  watchTimer = setInterval(() => {
    void pollWatchedThreads()
  }, 2000)
}

function stopWatchTimerIfIdle(): void {
  if (watchTimer && watchedThreadsByPanelId.size === 0) {
    clearInterval(watchTimer)
    watchTimer = null
  }
}

async function waitForProject(projectId: string, timeoutMs = 5000): Promise<ProjectRow> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const project = getProjectById(projectId)
    if (project) {
      return project
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`Timed out waiting for T3Code project ${projectId}`)
}

async function waitForThread(threadId: string, timeoutMs = 5000): Promise<ThreadRow> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const thread = getThreadById(threadId)
    if (thread && !thread.deletedAt) {
      return thread
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`Timed out waiting for T3Code thread ${threadId}`)
}

async function sendWsRequest<T>(baseUrl: string, body: Record<string, unknown>): Promise<T> {
  const started = Date.now()
  let lastError: Error | null = null

  while (Date.now() - started < 10000) {
    try {
      return await new Promise<T>((resolve, reject) => {
        const wsUrl = baseUrl.replace(/^http/, 'ws')
        const socket = new WebSocket(wsUrl)
        const requestId = `centipede-${crypto.randomUUID()}`
        let settled = false

        const finish = (callback: () => void) => {
          if (settled) {
            return
          }

          settled = true
          clearTimeout(timeout)
          socket.removeAllListeners()
          try {
            socket.close()
          } catch {
            // ignore
          }
          callback()
        }

        const timeout = setTimeout(() => {
          finish(() =>
            reject(new Error(`Timed out waiting for T3Code websocket response: ${String(body._tag)}`))
          )
        }, 30000)

        socket.on('open', () => {
          socket.send(
            JSON.stringify({
              id: requestId,
              body
            })
          )
        })

        socket.on('message', (raw) => {
          let parsed: { id?: string; result?: T; error?: { message?: string }; type?: string }

          try {
            parsed = JSON.parse(raw.toString())
          } catch {
            return
          }

          if (parsed.type === 'push' || parsed.id !== requestId) {
            return
          }

          if (parsed.error?.message) {
            finish(() => reject(new Error(parsed.error.message)))
            return
          }

          finish(() => resolve(parsed.result as T))
        })

        socket.on('error', (error) => {
          finish(() => reject(error))
        })

        socket.on('close', () => {
          if (!settled) {
            finish(() => reject(new Error('T3Code websocket connection closed unexpectedly')))
          }
        })
      })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (
        !/ECONNREFUSED|closed unexpectedly/i.test(lastError.message) &&
        !(lastError as NodeJS.ErrnoException).code?.includes?.('ECONNREFUSED')
      ) {
        throw lastError
      }

      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  throw lastError ?? new Error('Timed out connecting to T3Code websocket')
}

function buildEmbeddedThreadUrl(baseUrl: string, threadId: string): string {
  return new URL(`/embed/thread/${threadId}`, `${baseUrl}/`).toString()
}

export async function ensureRuntime(): Promise<{ baseUrl: string; logPath: string }> {
  if (runtime && runtime.process.exitCode === null) {
    return { baseUrl: runtime.baseUrl, logPath: runtime.logPath }
  }

  if (pendingRuntimeStart) {
    return pendingRuntimeStart
  }

  const config = getT3CodeConfig()
  if (!existsSync(config.sourcePath)) {
    throw new Error(`T3Code source not found at ${config.sourcePath}`)
  }

  pendingRuntimeStart = (async () => {
    ensureBuilt(config.sourcePath, config.installCommand, config.buildCommand)

    const port = await getFreePort()
    const baseUrl = `http://127.0.0.1:${port}`
    const entrypoint = join(config.sourcePath, config.entrypoint)
    const stateDir = getStateDir()
    const logPath = getLogPath()
    mkdirSync(stateDir, { recursive: true })
    mkdirSync(dirname(logPath), { recursive: true })
    const logFd = openSync(logPath, 'a')

    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    delete env.T3CODE_AUTH_TOKEN
    env.PATH = prependBrowserCliToPath(env.PATH)
    env.CENTIPEDE_BROWSER = getBrowserCommandPath()
    env.CENTIPEDE_BROWSER_CLI = getBrowserCliCommandPath()
    env.CENTIPEDE_BROWSER_SESSION_FILE = getBrowserCliSessionFilePath()
    env.T3CODE_MODE = 'web'
    env.T3CODE_HOST = '127.0.0.1'
    env.T3CODE_PORT = String(port)
    env.T3CODE_NO_BROWSER = '1'
    env.T3CODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD = '0'
    env.T3CODE_HOME = stateDir
    env.T3CODE_STATE_DIR = stateDir

    const child = spawn(
      'node',
      [
        entrypoint,
        '--mode',
        'web',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--home-dir',
        stateDir,
        '--auth-token',
        '',
        '--no-browser'
      ],
      {
        cwd: config.sourcePath,
        env,
        stdio: ['ignore', logFd, logFd]
      }
    )

    child.on('exit', () => {
      runtime = null
      pendingRuntimeStart = null
      closeSync(logFd)
    })

    runtime = {
      process: child,
      baseUrl,
      logPath,
      stateDir
    }

    try {
      await waitForReady(baseUrl)
      await waitForAppShell(baseUrl)
      await waitForWebSocketReady(baseUrl)
      return { baseUrl, logPath }
    } catch (error) {
      child.kill()
      runtime = null
      throw error
    } finally {
      pendingRuntimeStart = null
    }
  })()

  return pendingRuntimeStart
}

export async function ensureT3Project(input: {
  centipedeProjectId: string
  projectPath: string
  projectName: string
  existingT3ProjectId?: string
}): Promise<{ t3ProjectId: string }> {
  const pendingKey = input.existingT3ProjectId || getProjectBindingId(input.centipedeProjectId)
  const pending = pendingProjectEnsures.get(pendingKey)
  if (pending) {
    return pending
  }

  const ensurePromise = (async () => {
  const { baseUrl } = await ensureRuntime()
  const t3ProjectId = input.existingT3ProjectId || getProjectBindingId(input.centipedeProjectId)
  const existing = getProjectById(t3ProjectId)

  if (existing) {
    if (existing.workspaceRoot !== input.projectPath || existing.title !== input.projectName) {
      await sendWsRequest(baseUrl, {
        _tag: 'orchestration.dispatchCommand',
        command: {
          type: 'project.meta.update',
          commandId: crypto.randomUUID(),
          projectId: t3ProjectId,
          title: input.projectName,
          workspaceRoot: input.projectPath
        }
      })
      await waitForProject(t3ProjectId)
    }

    return { t3ProjectId }
  }

    try {
      await sendWsRequest(baseUrl, {
        _tag: 'orchestration.dispatchCommand',
        command: {
          type: 'project.create',
          commandId: crypto.randomUUID(),
          projectId: t3ProjectId,
          title: input.projectName,
          workspaceRoot: input.projectPath,
          defaultModelSelection: DEFAULT_MODEL_SELECTION,
          createdAt: new Date().toISOString()
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/already exists and cannot be created twice/i.test(message)) {
        throw error
      }
    }

    await waitForProject(t3ProjectId)
    return { t3ProjectId }
  })()

  pendingProjectEnsures.set(pendingKey, ensurePromise)

  try {
    return await ensurePromise
  } finally {
    pendingProjectEnsures.delete(pendingKey)
  }
}

async function createThread(projectId: string): Promise<ThreadRow> {
  const activeProject = await waitForProject(projectId)
  const { baseUrl } = await ensureRuntime()
  const threadId = crypto.randomUUID()
  const modelSelection = parseModelSelection(activeProject.defaultModelSelectionJson)

  await sendWsRequest(baseUrl, {
    _tag: 'orchestration.dispatchCommand',
    command: {
      type: 'thread.create',
      commandId: crypto.randomUUID(),
      threadId,
      projectId,
      title: 'New thread',
      modelSelection,
      runtimeMode: 'full-access',
      interactionMode: 'default',
      branch: null,
      worktreePath: null,
      createdAt: new Date().toISOString()
    }
  })

  return waitForThread(threadId)
}

export async function ensurePanelThread(input: {
  panelId: string
  centipedeProjectId: string
  projectPath: string
  projectName: string
  existingT3ProjectId?: string
  existingT3ThreadId?: string
}): Promise<{
  baseUrl: string
  t3ProjectId: string
  t3ThreadId: string
  threadTitle: string | null
  lastUserMessageAt: string | null
}> {
  const pending = pendingPanelThreadEnsures.get(input.panelId)
  if (pending) {
    return pending
  }

  const ensurePromise = (async () => {
    const { baseUrl } = await ensureRuntime()
    const { t3ProjectId } = await ensureT3Project({
      centipedeProjectId: input.centipedeProjectId,
      projectPath: input.projectPath,
      projectName: input.projectName,
      existingT3ProjectId: input.existingT3ProjectId
    })

    let thread = input.existingT3ThreadId ? getThreadById(input.existingT3ThreadId) : null
    if (!thread || thread.deletedAt || thread.projectId !== t3ProjectId) {
      thread = await createThread(t3ProjectId)
    }

    const metadata = getThreadMetadata(thread.threadId)

    return {
      baseUrl,
      t3ProjectId,
      t3ThreadId: thread.threadId,
      threadTitle: metadata.threadTitle,
      lastUserMessageAt: metadata.lastUserMessageAt
    }
  })()

  pendingPanelThreadEnsures.set(input.panelId, ensurePromise)

  try {
    return await ensurePromise
  } finally {
    pendingPanelThreadEnsures.delete(input.panelId)
  }
}

export async function getThreadInfo(t3ThreadId: string): Promise<T3CodeThreadInfo> {
  const activeRuntime = runtime
  const metadata = getThreadMetadata(t3ThreadId)

  return {
    url:
      activeRuntime && activeRuntime.process.exitCode === null
        ? buildEmbeddedThreadUrl(activeRuntime.baseUrl, t3ThreadId)
        : null,
    threadTitle: metadata.threadTitle,
    lastUserMessageAt: metadata.lastUserMessageAt
  }
}

export function watchThread(input: {
  panelId: string
  t3ThreadId: string
  priority: 'focused' | 'active' | 'inactive'
}): boolean {
  const metadata = getThreadMetadata(input.t3ThreadId)
  watchedThreadsByPanelId.set(input.panelId, {
    panelId: input.panelId,
    t3ThreadId: input.t3ThreadId,
    priority: input.priority,
    lastPolledAt: 0,
    lastSnapshot: metadata
  })
  ensureWatchTimer()
  return true
}

export function unwatchThread(panelId: string): boolean {
  const didDelete = watchedThreadsByPanelId.delete(panelId)
  stopWatchTimerIfIdle()
  return didDelete
}

export function getWatchedThreadCount(): number {
  return watchedThreadsByPanelId.size
}

export function getT3CodeLastUserMessageAt(t3ThreadId: string): string | null {
  return getThreadMetadata(t3ThreadId).lastUserMessageAt
}

export function stopSharedRuntime(): void {
  const activeRuntime = runtime
  runtime = null
  pendingRuntimeStart = null
  if (!activeRuntime) {
    return
  }

  activeRuntime.process.kill()
}

export function stopAllT3Code(): void {
  watchedThreadsByPanelId.clear()
  stopWatchTimerIfIdle()
  stopSharedRuntime()
}
