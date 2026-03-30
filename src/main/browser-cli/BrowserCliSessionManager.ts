import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { getProject } from '../db/projects.repo'
import { getDb } from '../db/database'
import { getApiPort } from '../api/BrowserApiServer'
import { registerToken, revokeToken } from '../api/TokenRegistry'
import { getCdpProxyPort } from '../cdp/CdpProxyManager'
import { getBrowserCliSessionFilePath } from './BrowserCliPathManager'

interface BrowserCliSessionRecord {
  appInstanceId: string
  processId: number
  projectId: string
  workspaceId: string
  projectName: string
  workspaceName: string
  browserApiBaseUrl: string
  browserApiToken: string
  cdpEndpoint: string | null
  focusedBrowserPanelId: string | null
  focused: boolean
  lastHeartbeatAt: string
}

interface RendererSessionState {
  activeProjectId: string | null
  activeWorkspaceId: string | null
  focusedBrowserPanelId: string | null
}

const appInstanceId = randomUUID()
let currentScope: RendererSessionState = {
  activeProjectId: null,
  activeWorkspaceId: null,
  focusedBrowserPanelId: null
}
let currentToken: string | null = null
let currentTokenScope: { projectId: string; workspaceId: string } | null = null
let heartbeatTimer: NodeJS.Timeout | null = null
let currentProjectName: string | null = null
let currentWorkspaceName: string | null = null

function readSessionFile(): BrowserCliSessionRecord[] {
  const sessionFile = getBrowserCliSessionFilePath()

  try {
    const raw = readFileSync(sessionFile, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as BrowserCliSessionRecord[]) : []
  } catch {
    return []
  }
}

function writeSessionFile(records: BrowserCliSessionRecord[]): void {
  const sessionFile = getBrowserCliSessionFilePath()
  mkdirSync(dirname(sessionFile), { recursive: true })
  writeFileSync(sessionFile, JSON.stringify(records, null, 2))
}

function resolveWorkspaceName(workspaceId: string): string | null {
  const row = getDb()
    .prepare('SELECT name FROM workspaces WHERE id = ?')
    .get(workspaceId) as { name?: string } | undefined
  return row?.name ?? null
}

function buildSessionRecord(): BrowserCliSessionRecord | null {
  if (!currentScope.activeProjectId || !currentScope.activeWorkspaceId || !currentToken) {
    return null
  }

  if (!currentProjectName || !currentWorkspaceName) {
    return null
  }

  const browserApiBaseUrl = `http://127.0.0.1:${getApiPort()}`
  const cdpPort = getCdpProxyPort(currentScope.activeWorkspaceId)

  return {
    appInstanceId,
    processId: process.pid,
    projectId: currentScope.activeProjectId,
    workspaceId: currentScope.activeWorkspaceId,
    projectName: currentProjectName,
    workspaceName: currentWorkspaceName,
    browserApiBaseUrl,
    browserApiToken: currentToken,
    cdpEndpoint: cdpPort ? `http://127.0.0.1:${cdpPort}` : null,
    focusedBrowserPanelId: currentScope.focusedBrowserPanelId,
    focused: true,
    lastHeartbeatAt: new Date().toISOString()
  }
}

function persistCurrentSession(): void {
  const nextRecord = buildSessionRecord()
  const records = readSessionFile().filter((entry) => entry.appInstanceId !== appInstanceId)

  if (nextRecord) {
    records.push(nextRecord)
  }

  if (records.length === 0) {
    rmSync(getBrowserCliSessionFilePath(), { force: true })
    return
  }

  writeSessionFile(records)
}

function clearRegisteredToken(): void {
  if (!currentToken) {
    return
  }

  revokeToken(currentToken)
  currentToken = null
  currentTokenScope = null
}

function ensureHeartbeat(): void {
  if (heartbeatTimer) {
    return
  }

  heartbeatTimer = setInterval(() => {
    persistCurrentSession()
  }, 5000)
}

function stopHeartbeat(): void {
  if (!heartbeatTimer) {
    return
  }

  clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

export function updateBrowserCliSessionScope(input: RendererSessionState): void {
  currentScope = input

  if (!input.activeProjectId || !input.activeWorkspaceId) {
    clearRegisteredToken()
    stopHeartbeat()
    currentProjectName = null
    currentWorkspaceName = null
    persistCurrentSession()
    return
  }

  if (
    !currentProjectName ||
    currentTokenScope?.projectId !== input.activeProjectId
  ) {
    currentProjectName = getProject(input.activeProjectId)?.name ?? null
  }

  if (
    !currentWorkspaceName ||
    currentTokenScope?.workspaceId !== input.activeWorkspaceId
  ) {
    currentWorkspaceName = resolveWorkspaceName(input.activeWorkspaceId)
  }

  const requiresNewToken =
    !currentToken ||
    currentTokenScope?.projectId !== input.activeProjectId ||
    currentTokenScope?.workspaceId !== input.activeWorkspaceId

  if (requiresNewToken) {
    clearRegisteredToken()
    currentToken = randomUUID().replace(/-/g, '')
    registerToken(currentToken, input.activeWorkspaceId, input.activeProjectId)
    currentTokenScope = {
      projectId: input.activeProjectId,
      workspaceId: input.activeWorkspaceId
    }
  }

  ensureHeartbeat()
  persistCurrentSession()
}

export function touchBrowserCliSession(): void {
  persistCurrentSession()
}

export function getBrowserCliSessionSnapshot():
  | (BrowserCliSessionRecord & {
      capabilities: {
        activatePanel: true
        createPanel: true
        closePanel: true
        listPanels: true
      }
    })
  | null {
  const record = buildSessionRecord()
  if (!record) {
    return null
  }

  return {
    ...record,
    capabilities: {
      activatePanel: true,
      createPanel: true,
      closePanel: true,
      listPanels: true
    }
  }
}

export function clearBrowserCliSession(): void {
  stopHeartbeat()
  clearRegisteredToken()
  persistCurrentSession()
}
