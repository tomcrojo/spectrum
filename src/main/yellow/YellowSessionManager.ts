import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { getProject } from '../db/projects.repo'
import { listWorkspaces } from '../db/workspaces.repo'
import { getApiPort } from '../api/BrowserApiServer'
import { registerToken, revokeToken } from '../api/TokenRegistry'
import { getCdpProxyPort } from '../cdp/CdpProxyManager'
import { getYellowSessionFilePath } from './YellowPathManager'

interface YellowSessionRecord {
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

function readSessionFile(): YellowSessionRecord[] {
  const sessionFile = getYellowSessionFilePath()

  try {
    const raw = readFileSync(sessionFile, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as YellowSessionRecord[]) : []
  } catch {
    return []
  }
}

function writeSessionFile(records: YellowSessionRecord[]): void {
  const sessionFile = getYellowSessionFilePath()
  mkdirSync(dirname(sessionFile), { recursive: true })
  writeFileSync(sessionFile, JSON.stringify(records, null, 2))
}

function resolveWorkspaceName(projectId: string, workspaceId: string): string | null {
  const workspace = listWorkspaces({ projectId, includeArchived: true }).find(
    (entry) => entry.id === workspaceId
  )
  return workspace?.name ?? null
}

function buildSessionRecord(): YellowSessionRecord | null {
  if (!currentScope.activeProjectId || !currentScope.activeWorkspaceId || !currentToken) {
    return null
  }

  const project = getProject(currentScope.activeProjectId)
  const workspaceName = resolveWorkspaceName(
    currentScope.activeProjectId,
    currentScope.activeWorkspaceId
  )

  if (!project || !workspaceName) {
    return null
  }

  const browserApiBaseUrl = `http://127.0.0.1:${getApiPort()}`
  const cdpPort = getCdpProxyPort(currentScope.activeWorkspaceId)

  return {
    appInstanceId,
    processId: process.pid,
    projectId: project.id,
    workspaceId: currentScope.activeWorkspaceId,
    projectName: project.name,
    workspaceName,
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
    rmSync(getYellowSessionFilePath(), { force: true })
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

export function updateYellowSessionScope(input: RendererSessionState): void {
  currentScope = input

  if (!input.activeProjectId || !input.activeWorkspaceId) {
    clearRegisteredToken()
    stopHeartbeat()
    persistCurrentSession()
    return
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

export function touchYellowSession(): void {
  persistCurrentSession()
}

export function getYellowSessionSnapshot():
  | (YellowSessionRecord & {
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

export function clearYellowSession(): void {
  stopHeartbeat()
  clearRegisteredToken()
  persistCurrentSession()
}
