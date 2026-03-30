import { spawn, spawnSync, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync, openSync, closeSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join, dirname } from 'path'
import net from 'net'
import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { getT3CodeConfig } from './config'
import { getApiPort } from '../api/BrowserApiServer'
import { registerToken, revokeToken } from '../api/TokenRegistry'
import {
  getBrowserCliSessionFilePath,
  prependBrowserCliToPath
} from '../browser-cli/BrowserCliPathManager'

interface RuntimeInstance {
  process: ChildProcess
  url: string
  instanceId: string
  projectPath: string
  logPath: string
  browserApiToken: string | null
}

interface BootstrapThreadInfo {
  threadId: string
  title: string
}

export interface T3CodeThreadInfo {
  url: string | null
  threadTitle: string | null
  lastUserMessageAt: string | null
}

const runtimes = new Map<string, RuntimeInstance>()
const pendingStarts = new Map<
  string,
  Promise<{
    url: string
    logPath: string
    threadTitle: string | null
    lastUserMessageAt: string | null
  }>
>()
const pendingStops = new Map<string, NodeJS.Timeout>()

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

async function getFreePort(): Promise<number> {
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

async function waitForReady(url: string, timeoutMs = 30000): Promise<void> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/global/health`)
      if (response.ok) return
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error('Timed out waiting for T3Code to become ready')
}

async function waitForAppShell(url: string, timeoutMs = 30000): Promise<void> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Timed out waiting for T3Code app shell')
}

function prepareLogPath(instanceId: string): string {
  const logsDir = join(homedir(), '.centipede-dev', 't3code-logs')
  mkdirSync(logsDir, { recursive: true })
  return join(logsDir, `${instanceId}.log`)
}

function resolveBootstrapThreadInfo(stateDir: string, projectPath: string): BootstrapThreadInfo | null {
  const stateDbPath = join(stateDir, 'userdata', 'state.sqlite')
  if (!existsSync(stateDbPath)) {
    return null
  }

  const db = new Database(stateDbPath, { readonly: true })

  try {
    const row = db
      .prepare(
        `SELECT t.thread_id AS threadId, t.title AS title
         FROM projection_threads t
         INNER JOIN projection_projects p ON p.project_id = t.project_id
         WHERE p.workspace_root = ? AND t.deleted_at IS NULL
         ORDER BY COALESCE(t.updated_at, t.created_at) DESC
         LIMIT 1`
      )
      .get(projectPath) as { threadId?: string; title?: string } | undefined

    if (!row?.threadId || !row.title) {
      return null
    }

    return {
      threadId: row.threadId,
      title: row.title
    }
  } catch {
    return null
  } finally {
    db.close()
  }
}

function resolveLatestUserMessageAt(stateDir: string, projectPath: string): string | null {
  const stateDbPath = join(stateDir, 'userdata', 'state.sqlite')
  if (!existsSync(stateDbPath)) {
    return null
  }

  const db = new Database(stateDbPath, { readonly: true })

  try {
    const row = db
      .prepare(
        `SELECT m.created_at AS lastUserMessageAt
         FROM projection_thread_messages m
         INNER JOIN projection_threads t ON t.thread_id = m.thread_id
         INNER JOIN projection_projects p ON p.project_id = t.project_id
         WHERE p.workspace_root = ?
           AND p.deleted_at IS NULL
           AND t.deleted_at IS NULL
           AND m.role = 'user'
         ORDER BY m.created_at DESC
         LIMIT 1`
      )
      .get(projectPath) as { lastUserMessageAt?: string } | undefined

    return row?.lastUserMessageAt ?? null
  } catch {
    return null
  } finally {
    db.close()
  }
}

export function getT3CodeLastUserMessageAt(
  instanceId: string,
  projectPath: string
): string | null {
  const stateDir = join(homedir(), '.centipede-dev', 't3code-state', instanceId)
  return resolveLatestUserMessageAt(stateDir, projectPath)
}

export function getT3CodeThreadInfo(
  instanceId: string,
  projectPath: string
): T3CodeThreadInfo {
  const runtime = runtimes.get(instanceId)
  const baseUrl = runtime?.url ?? null
  const stateDir = join(homedir(), '.centipede-dev', 't3code-state', instanceId)
  const threadInfo = resolveBootstrapThreadInfo(stateDir, projectPath)

  if (!threadInfo) {
    return {
      url: baseUrl,
      threadTitle: null,
      lastUserMessageAt: getT3CodeLastUserMessageAt(instanceId, projectPath)
    }
  }

  return {
    url: baseUrl ? new URL(`/${threadInfo.threadId}`, `${baseUrl}/`).toString() : null,
    threadTitle: threadInfo.title,
    lastUserMessageAt: getT3CodeLastUserMessageAt(instanceId, projectPath)
  }
}

async function waitForBootstrapThreadInfo(
  baseUrl: string,
  stateDir: string,
  projectPath: string,
  timeoutMs = 5000
): Promise<{ url: string; threadTitle: string | null; lastUserMessageAt: string | null }> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const threadInfo = resolveBootstrapThreadInfo(stateDir, projectPath)
    if (threadInfo) {
      return {
        url: new URL(`/${threadInfo.threadId}`, `${baseUrl}/`).toString(),
        threadTitle: threadInfo.title,
        lastUserMessageAt: resolveLatestUserMessageAt(stateDir, projectPath)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  return {
    url: baseUrl,
    threadTitle: null,
    lastUserMessageAt: resolveLatestUserMessageAt(stateDir, projectPath)
  }
}

export async function startT3Code(
  instanceId: string,
  projectPath: string,
  scope?: {
    workspaceId?: string
    projectId?: string
  }
): Promise<{
  url: string
  logPath: string
  threadTitle: string | null
  lastUserMessageAt: string | null
}> {
  const pendingStop = pendingStops.get(instanceId)
  if (pendingStop) {
    clearTimeout(pendingStop)
    pendingStops.delete(instanceId)
  }

  const existing = runtimes.get(instanceId)
  if (existing && existing.process.exitCode === null) {
    const threadInfo = await waitForBootstrapThreadInfo(
      existing.url,
      join(homedir(), '.centipede-dev', 't3code-state', instanceId),
      existing.projectPath,
      1500
    )
    return {
      url: threadInfo.url,
      logPath: existing.logPath,
      threadTitle: threadInfo.threadTitle,
      lastUserMessageAt: threadInfo.lastUserMessageAt
    }
  }

  const pending = pendingStarts.get(instanceId)
  if (pending) {
    return pending
  }

  const config = getT3CodeConfig()
  if (!existsSync(config.sourcePath)) {
    throw new Error(`T3Code source not found at ${config.sourcePath}`)
  }

  const startPromise = (async () => {
    ensureBuilt(config.sourcePath, config.installCommand, config.buildCommand)

    const port = await getFreePort()
    const url = `http://127.0.0.1:${port}`
    const entrypoint = join(config.sourcePath, config.entrypoint)
    const logPath = prepareLogPath(instanceId)
    mkdirSync(dirname(logPath), { recursive: true })
    const logFd = openSync(logPath, 'a')

    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    delete env.T3CODE_AUTH_TOKEN
    env.PATH = prependBrowserCliToPath(env.PATH)
    env.CENTIPEDE_BROWSER_SESSION_FILE = getBrowserCliSessionFilePath()
    env.T3CODE_MODE = 'web'
    env.T3CODE_HOST = '127.0.0.1'
    env.T3CODE_PORT = String(port)
    env.T3CODE_NO_BROWSER = '1'
    env.T3CODE_HOME = join(homedir(), '.centipede-dev', 't3code-state', instanceId)
    env.T3CODE_STATE_DIR = env.T3CODE_HOME
    mkdirSync(env.T3CODE_HOME, { recursive: true })

    const browserApiToken = scope?.workspaceId && scope.projectId ? nanoid(32) : null
    if (browserApiToken && scope?.workspaceId && scope.projectId) {
      registerToken(browserApiToken, scope.workspaceId, scope.projectId)
      env.CENTIPEDE_API_PORT = String(getApiPort())
      env.CENTIPEDE_API_TOKEN = browserApiToken
      env.CENTIPEDE_WORKSPACE_ID = scope.workspaceId
      env.CENTIPEDE_PROJECT_ID = scope.projectId
    }

    const child = spawn('node', [
      entrypoint,
      '--mode',
      'web',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--home-dir',
      env.T3CODE_HOME,
      '--auth-token',
      '',
      '--no-browser',
      '--auto-bootstrap-project-from-cwd'
    ], {
      cwd: projectPath,
      env,
      stdio: ['ignore', logFd, logFd]
    })

    child.on('exit', () => {
      if (browserApiToken) {
        revokeToken(browserApiToken)
      }
      runtimes.delete(instanceId)
      pendingStarts.delete(instanceId)
      closeSync(logFd)
    })

    runtimes.set(instanceId, {
      process: child,
      url,
      instanceId,
      projectPath,
      logPath,
      browserApiToken
    })

    try {
      await waitForReady(url)
      await waitForAppShell(url)
      await new Promise((resolve) => setTimeout(resolve, 350))
      const threadInfo = await waitForBootstrapThreadInfo(url, env.T3CODE_HOME, projectPath)
      return {
        url: threadInfo.url,
        logPath,
        threadTitle: threadInfo.threadTitle,
        lastUserMessageAt: threadInfo.lastUserMessageAt
      }
    } catch (error) {
      child.kill()
      if (browserApiToken) {
        revokeToken(browserApiToken)
      }
      runtimes.delete(instanceId)
      throw error
    } finally {
      pendingStarts.delete(instanceId)
    }
  })()

  pendingStarts.set(instanceId, startPromise)
  return startPromise
}

export function stopT3Code(instanceId: string): void {
  if (pendingStops.has(instanceId)) return

  const timer = setTimeout(() => {
    pendingStops.delete(instanceId)

    const instance = runtimes.get(instanceId)
    if (!instance) return
    if (instance.browserApiToken) {
      revokeToken(instance.browserApiToken)
    }
    instance.process.kill()
    runtimes.delete(instanceId)
  }, 1500)

  pendingStops.set(instanceId, timer)
}

export function stopAllT3Code(): void {
  for (const [, timer] of pendingStops) {
    clearTimeout(timer)
  }
  pendingStops.clear()

  for (const [instanceId, instance] of runtimes) {
    if (instance.browserApiToken) {
      revokeToken(instance.browserApiToken)
    }
    instance.process.kill()
    runtimes.delete(instanceId)
  }
}
