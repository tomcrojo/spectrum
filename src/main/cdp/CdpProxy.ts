import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { webContents } from 'electron'
import { WebSocketServer, type WebSocket } from 'ws'

export interface CdpTargetSnapshot {
  id: string
  title: string
  url: string
  webContentsId: number
}

interface CdpTargetRuntime extends CdpTargetSnapshot {
  clients: Set<WebSocket>
  browserSessionIds: Set<string>
}

export class CdpProxy {
  private readonly browserId = randomUUID()
  private readonly targets = new Map<string, CdpTargetRuntime>()
  private readonly server = http.createServer(this.handleHttpRequest.bind(this))
  private readonly wsServer = new WebSocketServer({ noServer: true })
  private port: number | null = null
  private readonly debuggerListeners = new Map<number, (...args: unknown[]) => void>()
  private readonly browserClients = new Set<WebSocket>()

  constructor(
    private readonly workspaceId: string,
    private readonly onTargetAutomationStateChanged?: (
      targetId: string,
      automationAttached: boolean
    ) => void
  ) {
    this.server.on('upgrade', this.handleUpgrade.bind(this))
  }

  async start(): Promise<number> {
    if (this.port !== null) {
      return this.port
    }

    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(0, '127.0.0.1', () => {
        this.server.removeListener('error', reject)
        resolve()
      })
    })

    const address = this.server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start CDP proxy server')
    }

    this.port = address.port
    return address.port
  }

  getPort(): number | null {
    return this.port
  }

  listTargets(): CdpTargetSnapshot[] {
    return Array.from(this.targets.values()).map((target) => ({
      id: target.id,
      title: target.title,
      url: target.url,
      webContentsId: target.webContentsId
    }))
  }

  registerTarget(target: CdpTargetSnapshot): void {
    const existing = this.targets.get(target.id)
    if (existing) {
      existing.title = target.title
      existing.url = target.url
      existing.webContentsId = target.webContentsId
      this.emitAutomationStateChanged(target.id)
      return
    }

    this.targets.set(target.id, {
      ...target,
      clients: new Set<WebSocket>(),
      browserSessionIds: new Set<string>()
    })
    this.emitAutomationStateChanged(target.id)
  }

  updateTarget(targetId: string, patch: { title?: string; url?: string }): void {
    const target = this.targets.get(targetId)
    if (!target) {
      return
    }
    if (typeof patch.title === 'string') {
      target.title = patch.title
    }
    if (typeof patch.url === 'string') {
      target.url = patch.url
    }
  }

  unregisterTarget(targetId: string): void {
    const target = this.targets.get(targetId)
    if (!target) {
      return
    }

    for (const client of target.clients) {
      client.close()
    }
    target.clients.clear()

    this.detachDebuggerIfUnused(target.webContentsId)
    this.targets.delete(targetId)
    this.emitAutomationStateChanged(targetId)
  }

  hasAttachedClients(targetId: string): boolean {
    const target = this.targets.get(targetId)
    return Boolean(target && (target.clients.size > 0 || target.browserSessionIds.size > 0))
  }

  async shutdown(): Promise<void> {
    for (const target of this.targets.values()) {
      for (const client of target.clients) {
        client.close()
      }
      this.detachDebuggerIfUnused(target.webContentsId)
    }

    this.targets.clear()

    for (const client of this.browserClients) {
      client.close()
    }
    this.browserClients.clear()

    await new Promise<void>((resolve) => {
      this.wsServer.close(() => resolve())
    })

    await new Promise<void>((resolve) => {
      this.server.close(() => resolve())
    })
  }

  private handleHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const port = this.port ?? 0
    const host = `127.0.0.1:${port}`

    if (req.method !== 'GET') {
      res.statusCode = 405
      res.end()
      return
    }

    if (req.url === '/json/version') {
      this.writeJson(res, {
        Browser: 'Centipede/Electron',
        'Protocol-Version': '1.3',
        webSocketDebuggerUrl: `ws://${host}/devtools/browser/${this.browserId}`
      })
      return
    }

    if (req.url === '/json/list' || req.url === '/json') {
      const list = this.listTargets().map((target) => ({
        id: target.id,
        type: 'page',
        title: target.title,
        url: target.url,
        webSocketDebuggerUrl: `ws://${host}/devtools/page/${target.id}`
      }))
      this.writeJson(res, list)
      return
    }

    if (req.url === '/json/protocol') {
      this.writeJson(res, {})
      return
    }

    res.statusCode = 404
    res.end()
  }

  private handleUpgrade(
    request: http.IncomingMessage,
    socket: any,
    head: Buffer
  ): void {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1')

    if (pathname.startsWith('/devtools/page/')) {
      const targetId = pathname.replace('/devtools/page/', '')
      this.wsServer.handleUpgrade(request, socket, head, (ws) => {
        this.handlePageSocket(ws, targetId)
      })
      return
    }

    if (pathname.startsWith('/devtools/browser/')) {
      this.wsServer.handleUpgrade(request, socket, head, (ws) => {
        this.handleBrowserSocket(ws)
      })
      return
    }

    socket.destroy()
  }

  private handleBrowserSocket(ws: WebSocket): void {
    this.browserClients.add(ws)
    const sessionToTarget = new Map<string, string>()

    ws.on('message', async (raw) => {
      let message: any
      try {
        message = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (!message || typeof message.id !== 'number' || typeof message.method !== 'string') {
        return
      }

      try {
        const result = await this.handleBrowserCommand(
          message.method,
          message.params ?? {},
          message.sessionId,
          sessionToTarget
        )
        ws.send(JSON.stringify({ id: message.id, result }))
      } catch (error) {
        ws.send(
          JSON.stringify({
            id: message.id,
            error: { message: error instanceof Error ? error.message : 'CDP command failed' }
          })
        )
      }
    })

    ws.on('close', () => {
      for (const [sessionId, targetId] of sessionToTarget) {
        const target = this.targets.get(targetId)
        if (target) {
          target.browserSessionIds.delete(sessionId)
          this.detachDebuggerIfUnused(target.webContentsId)
          this.emitAutomationStateChanged(targetId)
        }
      }
      this.browserClients.delete(ws)
    })
  }

  private async handleBrowserCommand(
    method: string,
    params: Record<string, unknown>,
    sessionId: string | undefined,
    sessionToTarget: Map<string, string>
  ): Promise<unknown> {
    if (method === 'Browser.getVersion') {
      return {
        protocolVersion: '1.3',
        product: 'Centipede/Electron',
        revision: '0',
        userAgent: 'Centipede',
        jsVersion: '1.0'
      }
    }

    if (method === 'Target.getBrowserContexts') {
      return { browserContextIds: ['default'] }
    }

    if (method === 'Target.setDiscoverTargets' || method === 'Target.setAutoAttach') {
      return {}
    }

    if (method === 'Target.getTargets') {
      return {
        targetInfos: this.listTargets().map((target) => ({
          targetId: target.id,
          type: 'page',
          title: target.title,
          url: target.url,
          attached: false,
          browserContextId: 'default'
        }))
      }
    }

    if (method === 'Target.attachToTarget') {
      const targetId = String(params.targetId ?? '')
      const target = this.targets.get(targetId)
      if (!target) {
        throw new Error(`Unknown target: ${targetId}`)
      }
      const nextSessionId = randomUUID()
      sessionToTarget.set(nextSessionId, targetId)
      target.browserSessionIds.add(nextSessionId)
      this.ensureDebuggerAttached(target.webContentsId)
      this.emitAutomationStateChanged(targetId)
      return { sessionId: nextSessionId }
    }

    if (method === 'Target.detachFromTarget') {
      const detachedSessionId = String(params.sessionId ?? '')
      const targetId = sessionToTarget.get(detachedSessionId)
      if (targetId) {
        sessionToTarget.delete(detachedSessionId)
        const target = this.targets.get(targetId)
        if (target) {
          target.browserSessionIds.delete(detachedSessionId)
          this.detachDebuggerIfUnused(target.webContentsId)
          this.emitAutomationStateChanged(targetId)
        }
      }
      return {}
    }

    if (method === 'Target.activateTarget' || method === 'Runtime.runIfWaitingForDebugger') {
      return {}
    }

    if (sessionId) {
      const targetId = sessionToTarget.get(sessionId)
      if (!targetId) {
        throw new Error(`Unknown session: ${sessionId}`)
      }
      const target = this.targets.get(targetId)
      if (!target) {
        throw new Error(`Unknown target for session: ${sessionId}`)
      }
      const wc = webContents.fromId(target.webContentsId)
      if (!wc) {
        throw new Error(`Missing webContents for target: ${targetId}`)
      }

      this.ensureDebuggerAttached(target.webContentsId)
      return wc.debugger.sendCommand(method, params)
    }

    return {}
  }

  private handlePageSocket(ws: WebSocket, targetId: string): void {
    const target = this.targets.get(targetId)
    if (!target) {
      ws.close()
      return
    }

    const wc = webContents.fromId(target.webContentsId)
    if (!wc) {
      ws.close()
      return
    }

    this.ensureDebuggerAttached(target.webContentsId)
    target.clients.add(ws)
    this.emitAutomationStateChanged(targetId)

    ws.on('message', async (raw) => {
      let message: any
      try {
        message = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (!message || typeof message.id !== 'number' || typeof message.method !== 'string') {
        return
      }

      try {
        const result = await wc.debugger.sendCommand(message.method, message.params ?? {})
        ws.send(JSON.stringify({ id: message.id, result }))
      } catch (error) {
        ws.send(
          JSON.stringify({
            id: message.id,
            error: { message: error instanceof Error ? error.message : 'CDP command failed' }
          })
        )
      }
    })

    ws.on('close', () => {
      target.clients.delete(ws)
      this.detachDebuggerIfUnused(target.webContentsId)
      this.emitAutomationStateChanged(targetId)
    })
  }

  private emitAutomationStateChanged(targetId: string): void {
    this.onTargetAutomationStateChanged?.(targetId, this.hasAttachedClients(targetId))
  }

  private ensureDebuggerAttached(webContentsId: number): void {
    const wc = webContents.fromId(webContentsId)
    if (!wc) {
      return
    }

    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3')
    }

    if (this.debuggerListeners.has(webContentsId)) {
      return
    }

    const listener = (
      _event: unknown,
      method: string,
      params: Record<string, unknown>
    ) => {
      const target = this.getTargetByWebContentsId(webContentsId)
      if (!target) {
        return
      }

      for (const client of target.clients) {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ method, params }))
        }
      }

      for (const browserClient of this.browserClients) {
        if (browserClient.readyState !== browserClient.OPEN) {
          continue
        }
        for (const sessionId of target.browserSessionIds) {
          browserClient.send(JSON.stringify({ sessionId, method, params }))
        }
      }
    }

    wc.debugger.on('message', listener as any)
    this.debuggerListeners.set(webContentsId, listener)
  }

  private detachDebuggerIfUnused(webContentsId: number): void {
    const target = this.getTargetByWebContentsId(webContentsId)
    if (target && (target.clients.size > 0 || target.browserSessionIds.size > 0)) {
      return
    }

    const wc = webContents.fromId(webContentsId)
    if (!wc) {
      this.debuggerListeners.delete(webContentsId)
      return
    }

    const listener = this.debuggerListeners.get(webContentsId)
    if (listener) {
      wc.debugger.removeListener('message', listener as any)
      this.debuggerListeners.delete(webContentsId)
    }

    if (wc.debugger.isAttached()) {
      wc.debugger.detach()
    }
  }

  private getTargetByWebContentsId(webContentsId: number): CdpTargetRuntime | null {
    for (const target of this.targets.values()) {
      if (target.webContentsId === webContentsId) {
        return target
      }
    }
    return null
  }

  private writeJson(res: http.ServerResponse, payload: unknown): void {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
  }
}
