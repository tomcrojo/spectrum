import http from 'node:http'
import { getProject } from '../db/projects.repo'
import {
  closeBrowserPanel,
  listBrowserPanels,
  navigateBrowserPanel,
  openBrowserPanel,
  resizeBrowserPanel
} from '../browser/BrowserPanelManager'
import { getCdpProxyPort } from '../cdp/CdpProxyManager'
import { validateToken } from './TokenRegistry'

interface BrowserApiRequestBody {
  token?: string
  url?: string
  panelId?: string
  width?: number
  height?: number
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

      if (req.url === '/browser/open') {
        const url = typeof body.url === 'string' ? body.url : 'about:blank'
        const panel = openBrowserPanel({
          workspaceId,
          projectId,
          url,
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
        sendJson(res, 200, {
          panels: listBrowserPanels(workspaceId).map((panel) => ({
            panelId: panel.panelId,
            workspaceId: panel.workspaceId,
            projectId: panel.projectId,
            url: panel.url,
            panelTitle: panel.panelTitle,
            width: panel.width,
            height: panel.height
          }))
        })
        return
      }

      if (req.url === '/browser/cdp-endpoint') {
        const cdpPort = getCdpProxyPort(workspaceId)
        sendJson(res, 200, {
          endpoint: cdpPort ? `http://127.0.0.1:${cdpPort}` : null
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
