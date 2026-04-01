import http from 'node:http'
import {
  activateBrowserPanel,
  type BrowserPanelState,
  closeBrowserPanel,
  getBrowserPanel,
  getFocusedBrowserPanelId,
  listBrowserPanels,
  navigateBrowserPanel,
  openBrowserPanel,
  openTemporaryBrowserPanel,
  resizeBrowserPanel
} from '../browser/BrowserPanelManager'
import { getCdpProxyPort } from '../cdp/CdpProxyManager'
import { validateToken } from './TokenRegistry'
import { getProject } from '../db/projects.repo'
import { listWorkspaces } from '../db/workspaces.repo'
import { BrowserWindow } from 'electron'

interface BrowserApiRequestBody {
  token?: string
  url?: string
  panelId?: string
  parentPanelId?: string
  returnToPanelId?: string
  openedBy?: 'user' | 'agent' | 'popup'
  width?: number
  height?: number
}

function serializeBrowserPanel(
  panel: BrowserPanelState,
  input: {
    projectName: string | null
    workspaceName: string | null
    focusedPanelId: string | null
  }
) {
  return {
    panelId: panel.panelId,
    workspaceId: panel.workspaceId,
    projectId: panel.projectId,
    projectName: input.projectName,
    workspaceName: input.workspaceName,
    url: panel.url,
    panelTitle: panel.panelTitle,
    isTemporary: panel.isTemporary ?? false,
    parentPanelId: panel.parentPanelId ?? null,
    returnToPanelId: panel.returnToPanelId ?? null,
    openedBy: panel.openedBy ?? 'user',
    width: panel.width,
    height: panel.height,
    isFocused: input.focusedPanelId === panel.panelId,
    isVisible: true,
    kind: 'spectrum-browser-panel',
    webContentsId: panel.webContentsId ?? null,
    targetId: typeof panel.webContentsId === 'number' ? String(panel.webContentsId) : null
  }
}

let server: http.Server | null = null
let apiPort: number | null = null

async function readJsonBody(req: http.IncomingMessage): Promise<BrowserApiRequestBody> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw) as BrowserApiRequestBody
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function requireToken(body: BrowserApiRequestBody): { workspaceId: string; projectId: string } {
  const token = typeof body.token === 'string' ? body.token : ''
  const scope = validateToken(token)
  if (!scope) {
    throw new Error('Invalid token')
  }
  return scope
}

export async function startApiServer(): Promise<number> {
  if (server && apiPort !== null) {
    return apiPort
  }

  server = http.createServer(async (req, res) => {
    try {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      const body = await readJsonBody(req)
      const scope = requireToken(body)
      const project = getProject(scope.projectId)
      const workspaceId = scope.workspaceId
      const projectId = scope.projectId
      const workspace = listWorkspaces({ projectId, includeArchived: true }).find(
        (entry) => entry.id === workspaceId
      )

      if (req.url === '/browser/open') {
        const url = typeof body.url === 'string' ? body.url : 'about:blank'
        const panel = openBrowserPanel({
          workspaceId,
          projectId,
          url,
          openedBy: body.openedBy,
          width: typeof body.width === 'number' ? body.width : undefined,
          height: typeof body.height === 'number' ? body.height : undefined
        })
        sendJson(res, 200, {
          panelId: panel.panelId,
          workspaceId,
          projectId,
          cwd: project?.repoPath ?? null
        })
        return
      }

      if (req.url === '/browser/open-temporary') {
        if (typeof body.parentPanelId !== 'string') {
          sendJson(res, 400, { error: 'parentPanelId is required' })
          return
        }

        const url = typeof body.url === 'string' ? body.url : 'about:blank'
        const panel = openTemporaryBrowserPanel({
          workspaceId,
          projectId,
          url,
          parentPanelId: body.parentPanelId,
          returnToPanelId:
            typeof body.returnToPanelId === 'string' ? body.returnToPanelId : undefined,
          openedBy:
            body.openedBy === 'agent' || body.openedBy === 'popup' ? body.openedBy : undefined,
          width: typeof body.width === 'number' ? body.width : undefined,
          height: typeof body.height === 'number' ? body.height : undefined
        })
        if (!panel) {
          sendJson(res, 404, { error: 'Parent panel not found in workspace' })
          return
        }

        sendJson(res, 200, {
          panelId: panel.panelId,
          workspaceId,
          projectId,
          cwd: project?.repoPath ?? null
        })
        return
      }

      if (req.url === '/browser/navigate') {
        if (typeof body.panelId !== 'string' || typeof body.url !== 'string') {
          sendJson(res, 400, { error: 'panelId and url are required' })
          return
        }
        const panel = navigateBrowserPanel(workspaceId, body.panelId, body.url)
        if (!panel) {
          sendJson(res, 404, { error: 'Panel not found in workspace' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.url === '/browser/resize') {
        if (
          typeof body.panelId !== 'string' ||
          typeof body.width !== 'number' ||
          typeof body.height !== 'number'
        ) {
          sendJson(res, 400, { error: 'panelId, width, and height are required' })
          return
        }
        const panel = resizeBrowserPanel(workspaceId, body.panelId, body.width, body.height)
        if (!panel) {
          sendJson(res, 404, { error: 'Panel not found in workspace' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.url === '/browser/close') {
        if (typeof body.panelId !== 'string') {
          sendJson(res, 400, { error: 'panelId is required' })
          return
        }
        const panel = closeBrowserPanel(workspaceId, body.panelId)
        if (!panel) {
          sendJson(res, 404, { error: 'Panel not found in workspace' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.url === '/browser/list') {
        const focusedPanelId = getFocusedBrowserPanelId(workspaceId)
        sendJson(res, 200, {
          focusedBrowserPanelId: focusedPanelId,
          panels: listBrowserPanels(workspaceId).map((panel) =>
            serializeBrowserPanel(panel, {
              projectName: project?.name ?? null,
              workspaceName: workspace?.name ?? null,
              focusedPanelId
            })
          )
        })
        return
      }

      if (req.url === '/browser/get') {
        if (typeof body.panelId !== 'string') {
          sendJson(res, 400, { error: 'panelId is required' })
          return
        }

        const panel = getBrowserPanel(body.panelId)
        if (!panel || panel.workspaceId !== workspaceId) {
          sendJson(res, 404, { error: 'Panel not found in workspace' })
          return
        }

        sendJson(
          res,
          200,
          serializeBrowserPanel(panel, {
            projectName: project?.name ?? null,
            workspaceName: workspace?.name ?? null,
            focusedPanelId: getFocusedBrowserPanelId(workspaceId)
          })
        )
        return
      }

      if (req.url === '/browser/activate') {
        if (typeof body.panelId !== 'string') {
          sendJson(res, 400, { error: 'panelId is required' })
          return
        }
        const panel = activateBrowserPanel(workspaceId, body.panelId)
        if (!panel) {
          sendJson(res, 404, { error: 'Panel not found in workspace' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.url === '/browser/set-agent-focus') {
        if (typeof body.panelId !== 'string') {
          sendJson(res, 400, { error: 'panelId is required' })
          return
        }
        const panel = activateBrowserPanel(workspaceId, body.panelId)
        if (!panel) {
          sendJson(res, 404, { error: 'Panel not found in workspace' })
          return
        }
        sendJson(res, 200, { ok: true })
        return
      }

      if (req.url === '/browser/cdp-endpoint') {
        const cdpPort = getCdpProxyPort(workspaceId)
        sendJson(res, 200, {
          endpoint: cdpPort ? `http://127.0.0.1:${cdpPort}` : null
        })
        return
      }

      if (req.url === '/browser/session') {
        sendJson(res, 200, {
          appInstanceId: `workspace:${workspaceId}`,
          processId: process.pid,
          projectId,
          workspaceId,
          projectName: project?.name ?? null,
          workspaceName: workspace?.name ?? null,
          browserApiBaseUrl: `http://127.0.0.1:${getApiPort()}`,
          browserApiToken: typeof body.token === 'string' ? body.token : '',
          cdpEndpoint: getCdpProxyPort(workspaceId)
            ? `http://127.0.0.1:${getCdpProxyPort(workspaceId)}`
            : null,
          focusedBrowserPanelId: getFocusedBrowserPanelId(workspaceId),
          userFocusedPanelId: null,
          focused: BrowserWindow.getAllWindows().some(
            (window) => window.isVisible() && window.isFocused()
          ),
          lastHeartbeatAt: new Date().toISOString(),
          capabilities: {
            activatePanel: true,
            createPanel: true,
            closePanel: true,
            listPanels: true
          }
        })
        return
      }

      sendJson(res, 404, { error: 'Not found' })
    } catch (error) {
      sendJson(res, 401, {
        error: error instanceof Error ? error.message : 'Unauthorized'
      })
    }
  })

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(0, '127.0.0.1', () => {
      server!.removeListener('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start browser API server')
  }

  apiPort = address.port
  return address.port
}

export function getApiPort(): number {
  if (apiPort === null) {
    throw new Error('Browser API server is not started')
  }
  return apiPort
}

export async function stopApiServer(): Promise<void> {
  if (!server) {
    return
  }
  await new Promise<void>((resolve) => {
    server?.close(() => resolve())
  })
  server = null
  apiPort = null
}
