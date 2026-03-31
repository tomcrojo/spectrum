import { spawn, spawnSync, type ChildProcess } from 'child_process'
import {
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import net from 'net'
import Database from 'better-sqlite3'
import WebSocket from 'ws'
import { app, BrowserWindow } from 'electron'
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
  startedAt: number
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

type ThreadNotificationKind = 'requires-input' | 'completed'

interface ThreadMetadata {
  threadTitle: string | null
  lastUserMessageAt: string | null
  providerId: string | null
  notificationKind: ThreadNotificationKind | null
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
  providerId: string | null
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
    providerId: string | null
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

function getPackagedT3CodeRoot(): string {
  return join(process.resourcesPath, 't3code')
}

function isPackagedT3CodeSource(sourcePath: string): boolean {
  return (
    (existsSync(getPackagedT3CodeRoot()) && join(sourcePath) === getPackagedT3CodeRoot()) ||
    existsSync(join(sourcePath, '.spectrum-packaged-t3code-runtime'))
  )
}

function getPackagedT3CodeShadowRoot(): string {
  return join(homedir(), '.spectrum-dev', 'embedded', 't3code-runtime')
}

function writeRuntimePackageManifest(targetPath: string, name: string): void {
  writeFileSync(
    targetPath,
    JSON.stringify(
      {
        name,
        private: true,
        type: 'module'
      },
      null,
      2
    )
  )
}

function ensurePackagedT3CodeRuntimeReady(): string {
  const packagedRoot = getPackagedT3CodeRoot()
  const shadowRoot = getPackagedT3CodeShadowRoot()
  const versionFile = join(shadowRoot, '.version')
  const markerFile = join(shadowRoot, '.spectrum-packaged-t3code-runtime')
  const currentVersion = app.getVersion()

  if (
    existsSync(join(shadowRoot, 'apps', 'server', 'dist', 'index.mjs')) &&
    existsSync(join(shadowRoot, 'node_modules')) &&
    existsSync(markerFile) &&
    existsSync(versionFile) &&
    statSync(versionFile).isFile()
  ) {
    try {
      const version = readFileSync(versionFile, 'utf8').trim()
      if (version === currentVersion) {
        return shadowRoot
      }
    } catch {
      // Recreate the shadow runtime below.
    }
  }

  rmSync(shadowRoot, { recursive: true, force: true })
  mkdirSync(join(shadowRoot, 'apps', 'server'), { recursive: true })

  const packagedRootPackagePath = join(packagedRoot, 'package.json')
  const packagedServerPackagePath = join(packagedRoot, 'apps', 'server', 'package.json')

  if (existsSync(packagedRootPackagePath)) {
    copyFileSync(packagedRootPackagePath, join(shadowRoot, 'package.json'))
  } else {
    writeRuntimePackageManifest(join(shadowRoot, 'package.json'), '@spectrum/t3code-runtime')
  }

  if (existsSync(packagedServerPackagePath)) {
    copyFileSync(packagedServerPackagePath, join(shadowRoot, 'apps', 'server', 'package.json'))
  } else {
    writeRuntimePackageManifest(
      join(shadowRoot, 'apps', 'server', 'package.json'),
      '@spectrum/t3code-server-runtime'
    )
  }

  cpSync(
    join(packagedRoot, 'apps', 'server', 'dist'),
    join(shadowRoot, 'apps', 'server', 'dist'),
    { recursive: true }
  )
  symlinkSync(join(packagedRoot, 'runtime-node-modules'), join(shadowRoot, 'node_modules'), 'dir')
  writeFileSync(markerFile, '')
  writeFileSync(versionFile, currentVersion)

  return shadowRoot
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
  if (isPackagedT3CodeSource(sourcePath)) {
    return false
  }

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

function getLatestBuildOutputTime(sourcePath: string, entrypointPath: string): number {
  const webDistPath = join(sourcePath, 'apps', 'web', 'dist', 'index.html')

  return Math.max(
    existsSync(entrypointPath) ? statSync(entrypointPath).mtimeMs : 0,
    existsSync(webDistPath) ? statSync(webDistPath).mtimeMs : 0
  )
}

async function stopRuntimeInstance(instance: RuntimeInstance): Promise<void> {
  if (instance.process.exitCode !== null) {
    return
  }

  await new Promise<void>((resolve) => {
    let settled = false

    const finish = () => {
      if (settled) {
        return
      }

      settled = true
      instance.process.removeListener('exit', finish)
      resolve()
    }

    instance.process.once('exit', finish)

    try {
      instance.process.kill()
    } catch {
      finish()
      return
    }

    setTimeout(finish, 5000)
  })
}

function ensureBuilt(sourcePath: string, installCommand: string, buildCommand: string): void {
  if (app.isPackaged || isPackagedT3CodeSource(sourcePath)) {
    return
  }

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
  return join(homedir(), '.spectrum-dev', 't3code-state', GLOBAL_RUNTIME_ID)
}

function getLogPath(): string {
  const logsDir = join(homedir(), '.spectrum-dev', 't3code-logs')
  mkdirSync(logsDir, { recursive: true })
  return join(logsDir, `${GLOBAL_RUNTIME_ID}.log`)
}

function closeFileDescriptor(fd: number): void {
  try {
    closeSync(fd)
  } catch {
    // Ignore duplicate closes during shutdown/error races.
  }
}

function getPackagedNodeBinaryPath(): string {
  return join(process.resourcesPath, 'node-bin', process.platform === 'win32' ? 'node.exe' : 'node')
}

function resolveT3CodeRuntimeCommand(): string {
  const packagedNodePath = getPackagedNodeBinaryPath()
  if (existsSync(packagedNodePath)) {
    return packagedNodePath
  }

  return 'node'
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

function getProjectBindingId(spectrumProjectId: string): string {
  return `spectrum-project:${spectrumProjectId}`
}

function resolveT3ProjectBindingId(
  spectrumProjectId: string,
  existingT3ProjectId?: string
): string {
  const expectedBindingId = getProjectBindingId(spectrumProjectId)

  // Persisted panel state can be copied across workspaces or projects.
  // Never let that rebind a project to another project's embedded T3 state.
  if (existingT3ProjectId === expectedBindingId) {
    return existingT3ProjectId
  }

  return expectedBindingId
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

function computeNotificationKind(input: {
  sessionStatus: string | null
  pendingApprovalCount: number
  hasPendingUserInput: boolean
  latestTurnCompletedAt: string | null
}): ThreadNotificationKind | null {
  const { sessionStatus, pendingApprovalCount, hasPendingUserInput, latestTurnCompletedAt } = input

  // If the session is actively running, suppress notifications (not done yet)
  if (sessionStatus === 'running' || sessionStatus === 'connecting' || sessionStatus === 'starting') {
    return null
  }

  // Pending tool/command approvals → requires input
  if (pendingApprovalCount > 0) {
    return 'requires-input'
  }

  // Pending user input questions → requires input
  if (hasPendingUserInput) {
    return 'requires-input'
  }

  // Latest turn has completed → completed
  if (latestTurnCompletedAt) {
    return 'completed'
  }

  return null
}

function getThreadMetadata(threadId: string): ThreadMetadata {
  const db = openStateDb({ readonly: true })
  if (!db) {
    return {
      threadTitle: null,
      lastUserMessageAt: null,
      providerId: null,
      notificationKind: null
    }
  }

  try {
    const threadRow = db
      .prepare(
        `SELECT
           title,
           model_selection_json AS modelSelectionJson
         FROM projection_threads
         WHERE thread_id = ?
           AND deleted_at IS NULL`
      )
      .get(threadId) as { title?: string; modelSelectionJson?: string } | undefined

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

    // Query session status
    let sessionStatus: string | null = null
    try {
      const sessionRow = db
        .prepare(
          `SELECT status FROM projection_thread_sessions WHERE thread_id = ? LIMIT 1`
        )
        .get(threadId) as { status?: string } | undefined
      sessionStatus = sessionRow?.status ?? null
    } catch {
      // Table may not exist in older DB versions
    }

    // Query pending approvals
    let pendingApprovalCount = 0
    try {
      const approvalRow = db
        .prepare(
          `SELECT COUNT(*) as count FROM projection_pending_approvals WHERE thread_id = ? AND status = 'pending'`
        )
        .get(threadId) as { count?: number } | undefined
      pendingApprovalCount = approvalRow?.count ?? 0
    } catch {
      // Table may not exist
    }

    // Query pending user inputs (user-input.requested with no matching user-input.responded)
    let hasPendingUserInput = false
    try {
      // Collect all user-input.requested and user-input.responded activity payloads
      const activities = db
        .prepare(
          `SELECT kind, payload_json AS payloadJson
           FROM projection_thread_activities
           WHERE thread_id = ?
             AND kind IN ('user-input.requested', 'user-input.responded')
           ORDER BY sequence ASC, created_at ASC`
        )
        .all(threadId) as Array<{ kind: string; payloadJson: string | null }>

      const requestedIds = new Set<string>()
      const respondedIds = new Set<string>()

      for (const activity of activities) {
        try {
          const payload = activity.payloadJson ? JSON.parse(activity.payloadJson) : null
          const requestId = typeof payload?.requestId === 'string' ? payload.requestId : null
          if (!requestId) continue

          if (activity.kind === 'user-input.requested') {
            requestedIds.add(requestId)
          } else if (activity.kind === 'user-input.responded') {
            respondedIds.add(requestId)
          }
        } catch {
          // skip malformed payload
        }
      }

      hasPendingUserInput = [...requestedIds].some((id) => !respondedIds.has(id))
    } catch {
      // Table may not exist
    }

    // Query latest turn completion
    let latestTurnCompletedAt: string | null = null
    try {
      const turnRow = db
        .prepare(
          `SELECT completed_at AS completedAt
           FROM projection_turns
           WHERE thread_id = ?
             AND completed_at IS NOT NULL
           ORDER BY completed_at DESC
           LIMIT 1`
        )
        .get(threadId) as { completedAt?: string } | undefined
      latestTurnCompletedAt = turnRow?.completedAt ?? null
    } catch {
      // Table may not exist
    }

    const notificationKind = computeNotificationKind({
      sessionStatus,
      pendingApprovalCount,
      hasPendingUserInput,
      latestTurnCompletedAt
    })

    return {
      threadTitle: threadRow?.title ?? null,
      lastUserMessageAt: messageRow?.lastUserMessageAt ?? null,
      providerId: getProviderIdFromModelSelection(threadRow?.modelSelectionJson),
      notificationKind
    }
  } finally {
    db.close()
  }
}

function getProviderIdFromModelSelection(modelSelectionJson?: string | null): string | null {
  const parsed = parseModelSelection(modelSelectionJson)
  const providerId = parsed.provider
  return typeof providerId === 'string' && providerId.trim().length > 0 ? providerId : null
}

function emitThreadInfoChanged(payload: {
  panelId: string
  t3ThreadId: string
  threadTitle: string | null
  lastUserMessageAt: string | null
  providerId: string | null
  notificationKind: ThreadNotificationKind | null
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
      watch.lastSnapshot?.lastUserMessageAt === snapshot.lastUserMessageAt &&
      watch.lastSnapshot?.providerId === snapshot.providerId &&
      watch.lastSnapshot?.notificationKind === snapshot.notificationKind
    ) {
      continue
    }

    watch.lastSnapshot = snapshot
    emitThreadInfoChanged({
      panelId: watch.panelId,
      t3ThreadId: watch.t3ThreadId,
      threadTitle: snapshot.threadTitle,
      lastUserMessageAt: snapshot.lastUserMessageAt,
      providerId: snapshot.providerId,
      notificationKind: snapshot.notificationKind
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
        const requestId = `spectrum-${crypto.randomUUID()}`
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
  const config = getT3CodeConfig()
  const sourcePath = app.isPackaged
    ? ensurePackagedT3CodeRuntimeReady()
    : isPackagedT3CodeSource(config.sourcePath)
      ? ensurePackagedT3CodeRuntimeReady()
      : config.sourcePath

  if (!existsSync(sourcePath)) {
    throw new Error(`T3Code source not found at ${config.sourcePath}`)
  }

  const entrypointPath = join(sourcePath, config.entrypoint)
  const activeRuntime = runtime && runtime.process.exitCode === null ? runtime : null
  const needsRebuild = app.isPackaged ? false : shouldRebuild(sourcePath, entrypointPath)
  const latestBuildOutputTime = getLatestBuildOutputTime(sourcePath, entrypointPath)

  if (
    activeRuntime &&
    !needsRebuild &&
    latestBuildOutputTime <= activeRuntime.startedAt
  ) {
    return { baseUrl: activeRuntime.baseUrl, logPath: activeRuntime.logPath }
  }

  if (pendingRuntimeStart) {
    return pendingRuntimeStart
  }

  const startPromise = (async () => {
    if (needsRebuild) {
      ensureBuilt(sourcePath, config.installCommand, config.buildCommand)
    }

    const rebuiltOutputTime = getLatestBuildOutputTime(sourcePath, entrypointPath)
    const previousRuntime = runtime && runtime.process.exitCode === null ? runtime : null

    if (
      previousRuntime &&
      rebuiltOutputTime <= previousRuntime.startedAt
    ) {
      return { baseUrl: previousRuntime.baseUrl, logPath: previousRuntime.logPath }
    }

    if (previousRuntime) {
      await stopRuntimeInstance(previousRuntime)
    }

    const port = await getFreePort()
    const baseUrl = `http://127.0.0.1:${port}`
    const entrypoint = entrypointPath
    const stateDir = getStateDir()
    const logPath = getLogPath()
    mkdirSync(stateDir, { recursive: true })
    mkdirSync(dirname(logPath), { recursive: true })
    const logFd = openSync(logPath, 'a')

    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    delete env.T3CODE_AUTH_TOKEN
    env.PATH = prependBrowserCliToPath(env.PATH)
    env.SPECTRUM_BROWSER = getBrowserCommandPath()
    env.SPECTRUM_BROWSER_CLI = getBrowserCliCommandPath()
    env.SPECTRUM_BROWSER_SESSION_FILE = getBrowserCliSessionFilePath()
    env.T3CODE_MODE = 'web'
    env.T3CODE_HOST = '127.0.0.1'
    env.T3CODE_PORT = String(port)
    env.T3CODE_NO_BROWSER = '1'
    env.T3CODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD = '0'
    env.T3CODE_HOME = stateDir
    env.T3CODE_STATE_DIR = stateDir

    const runtimeCommand = resolveT3CodeRuntimeCommand()
    if (runtimeCommand === process.execPath) {
      env.ELECTRON_RUN_AS_NODE = '1'
    } else {
      delete env.ELECTRON_RUN_AS_NODE
    }

    const child = spawn(
      runtimeCommand,
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
        cwd: sourcePath,
        env,
        stdio: ['ignore', logFd, logFd]
      }
    )

    let didChildError = false
    const childStart = Promise.race([
      waitForReady(baseUrl)
        .then(() => waitForAppShell(baseUrl))
        .then(() => waitForWebSocketReady(baseUrl)),
      new Promise<never>((_, reject) => {
        child.once('error', (error) => {
          didChildError = true
          reject(error)
        })
      })
    ])

    child.on('exit', () => {
      if (runtime?.process === child) {
        runtime = null
      }
      if (pendingRuntimeStart === startPromise) {
        pendingRuntimeStart = null
      }
      closeFileDescriptor(logFd)
    })

    runtime = {
      process: child,
      baseUrl,
      logPath,
      stateDir,
      startedAt: Date.now()
    }

    try {
      await childStart
      return { baseUrl, logPath }
    } catch (error) {
      if (!didChildError && child.exitCode === null) {
        child.kill()
      }
      closeFileDescriptor(logFd)
      if (runtime?.process === child) {
        runtime = null
      }
      throw error
    } finally {
      if (pendingRuntimeStart === startPromise) {
        pendingRuntimeStart = null
      }
    }
  })()

  pendingRuntimeStart = startPromise

  return pendingRuntimeStart
}

export async function ensureT3Project(input: {
  spectrumProjectId: string
  projectPath: string
  projectName: string
  existingT3ProjectId?: string
}): Promise<{ t3ProjectId: string }> {
  const t3ProjectId = resolveT3ProjectBindingId(
    input.spectrumProjectId,
    input.existingT3ProjectId
  )
  const pendingKey = t3ProjectId
  const pending = pendingProjectEnsures.get(pendingKey)
  if (pending) {
    return pending
  }

  const ensurePromise = (async () => {
    const { baseUrl } = await ensureRuntime()
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
  spectrumProjectId: string
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
  providerId: string | null
}> {
  const pending = pendingPanelThreadEnsures.get(input.panelId)
  if (pending) {
    return pending
  }

  const ensurePromise = (async () => {
    const { baseUrl } = await ensureRuntime()
    const { t3ProjectId } = await ensureT3Project({
      spectrumProjectId: input.spectrumProjectId,
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
      lastUserMessageAt: metadata.lastUserMessageAt,
      providerId: metadata.providerId
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
    lastUserMessageAt: metadata.lastUserMessageAt,
    providerId: metadata.providerId
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
