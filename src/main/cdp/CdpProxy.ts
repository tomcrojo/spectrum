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

interface BrowserClientState {
  discoverTargets: boolean
  autoAttach: boolean
  flattenMode: boolean
  sessionToTarget: Map<string, string>
  autoAttachedSessionIds: Set<string>
}

interface WebContentsDebugger {
  isAttached(): boolean
  attach(protocolVersion: string): void
  detach(): void
  sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>
  on(event: 'message', listener: (...args: unknown[]) => void): void
  removeListener(event: 'message', listener: (...args: unknown[]) => void): void
}

interface WebContentsLike {
  debugger: WebContentsDebugger
}

interface CdpProxyDependencies {
  getWebContentsById(webContentsId: number): WebContentsLike | null
  randomId(): string
}

export class CdpProxy {
  private readonly browserId = randomUUID()
  private readonly targets = new Map<string, CdpTargetRuntime>()
  private readonly server = http.createServer(this.handleHttpRequest.bind(this))
  private readonly wsServer = new WebSocketServer({ noServer: true })
  private port: number | null = null
  private readonly debuggerListeners = new Map<number, (...args: unknown[]) => void>()
  private readonly browserClients = new Map<WebSocket, BrowserClientState>()

  constructor(
    private readonly workspaceId: string,
    private readonly onTargetAutomationStateChanged?: (
      targetId: string,
      automationAttached: boolean
    ) => void,
    private readonly dependencies: CdpProxyDependencies = {
      getWebContentsById: (webContentsId) => webContents.fromId(webContentsId) as WebContentsLike | null,
      randomId: () => randomUUID()
    }
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
      const previousWebContentsId = existing.webContentsId
      existing.title = target.title
      existing.url = target.url
      existing.webContentsId = target.webContentsId
      if (previousWebContentsId !== target.webContentsId) {
        this.detachDebuggerIfUnused(previousWebContentsId)
        if (existing.clients.size > 0 || existing.browserSessionIds.size > 0) {
          this.ensureDebuggerAttached(target.webContentsId)
        }
      }
      this.emitTargetInfoChanged(existing)
      this.emitAutomationStateChanged(target.id)
      return
    }

    const nextTarget: CdpTargetRuntime = {
      ...target,
      clients: new Set<WebSocket>(),
      browserSessionIds: new Set<string>()
    }

    this.targets.set(target.id, nextTarget)
    this.emitTargetCreated(nextTarget)
    this.autoAttachNewTarget(nextTarget)
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
    this.emitTargetInfoChanged(target)
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

    this.removeBrowserSessionsForTarget(targetId)
    this.emitTargetDestroyed(targetId)
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

    for (const client of this.browserClients.keys()) {
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
    const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method !== 'GET') {
      res.statusCode = 405
      res.end()
      return
    }

    if (pathname === '/json/version' || pathname === '/json/version/') {
      this.writeJson(res, {
        Browser: 'Spectrum/Electron',
        'Protocol-Version': '1.3',
        webSocketDebuggerUrl: `ws://${host}/devtools/browser/${this.browserId}`
      })
      return
    }

    if (
      pathname === '/json/list' ||
      pathname === '/json/list/' ||
      pathname === '/json' ||
      pathname === '/json/'
    ) {
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

    if (pathname === '/json/protocol' || pathname === '/json/protocol/') {
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
    const clientState: BrowserClientState = {
      discoverTargets: false,
      autoAttach: false,
      flattenMode: false,
      sessionToTarget: new Map<string, string>(),
      autoAttachedSessionIds: new Set<string>()
    }
    this.browserClients.set(ws, clientState)

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
          ws,
          clientState,
          message.method,
          message.params ?? {},
          message.sessionId
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
      this.cleanupBrowserClientSessions(clientState)
      this.browserClients.delete(ws)
    })
  }

  private async handleBrowserCommand(
    ws: WebSocket,
    clientState: BrowserClientState,
    method: string,
    params: Record<string, unknown>,
    sessionId: string | undefined
  ): Promise<unknown> {
    if (method === 'Browser.getVersion') {
      return {
        protocolVersion: '1.3',
        product: 'Spectrum/Electron',
        revision: '0',
        userAgent: 'Spectrum',
        jsVersion: '1.0'
      }
    }

    if (method === 'Target.getBrowserContexts') {
      return { browserContextIds: ['default'] }
    }

    if (method === 'Target.setDiscoverTargets') {
      clientState.discoverTargets = params.discover === true
      if (clientState.discoverTargets) {
        for (const target of this.targets.values()) {
          this.sendBrowserEvent(ws, 'Target.targetCreated', {
            targetInfo: this.buildTargetInfo(target, false)
          })
        }
      }
      return {}
    }

    if (method === 'Target.setAutoAttach') {
      const shouldAutoAttach = params.autoAttach === true && params.flatten === true

      if (!shouldAutoAttach) {
        clientState.autoAttach = false
        clientState.flattenMode = false
        this.cleanupAutoAttachedSessions(clientState)
        return {}
      }

      clientState.autoAttach = true
      clientState.flattenMode = true

      for (const target of this.targets.values()) {
        const attachedSessionId = this.ensureAttachedBrowserSession(clientState, target)
        if (attachedSessionId) {
          this.sendAttachedToTarget(ws, target, attachedSessionId)
        }
      }
      return {}
    }

    if (method === 'Target.getTargets') {
      return {
        targetInfos: this.listTargets().map((target) => ({
          ...this.buildTargetInfo(
            target,
            this.isTargetAttachedForClient(target.id, clientState)
          )
        }))
      }
    }

    if (method === 'Target.attachToTarget') {
      const targetId = String(params.targetId ?? '')
      const target = this.targets.get(targetId)
      if (!target) {
        throw new Error(`Unknown target: ${targetId}`)
      }
      const nextSessionId = this.dependencies.randomId()
      clientState.sessionToTarget.set(nextSessionId, targetId)
      target.browserSessionIds.add(nextSessionId)
      this.ensureDebuggerAttached(target.webContentsId)
      this.emitAutomationStateChanged(targetId)
      return { sessionId: nextSessionId }
    }

    if (method === 'Target.detachFromTarget') {
      const detachedSessionId = String(params.sessionId ?? '')
      const targetId = clientState.sessionToTarget.get(detachedSessionId)
      if (targetId) {
        clientState.sessionToTarget.delete(detachedSessionId)
        clientState.autoAttachedSessionIds.delete(detachedSessionId)
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
      const targetId = clientState.sessionToTarget.get(sessionId)
      if (!targetId) {
        throw new Error(`Unknown session: ${sessionId}`)
      }
      const target = this.targets.get(targetId)
      if (!target) {
        throw new Error(`Unknown target for session: ${sessionId}`)
      }
      const wc = this.dependencies.getWebContentsById(target.webContentsId)
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

    const wc = this.dependencies.getWebContentsById(target.webContentsId)
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
    const wc = this.dependencies.getWebContentsById(webContentsId)
    if (!wc) {
      return
    }

    if (!wc.debugger.isAttached()) {
      wc.debugger.attach('1.3')
    }

    if (this.debuggerListeners.has(webContentsId)) {
      return
    }

    const listener = (...args: unknown[]) => {
      const [, method, params] = args as [
        unknown,
        string,
        Record<string, unknown>
      ]
      const target = this.getTargetByWebContentsId(webContentsId)
      if (!target) {
        return
      }

      for (const client of target.clients) {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ method, params }))
        }
      }

      for (const browserClient of this.browserClients.keys()) {
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

    const wc = this.dependencies.getWebContentsById(webContentsId)
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

  private buildTargetInfo(target: CdpTargetSnapshot, attached: boolean): Record<string, unknown> {
    return {
      targetId: target.id,
      type: 'page',
      title: target.title,
      url: target.url,
      attached,
      browserContextId: 'default'
    }
  }

  private isTargetAttachedForClient(targetId: string, clientState: BrowserClientState): boolean {
    for (const attachedTargetId of clientState.sessionToTarget.values()) {
      if (attachedTargetId === targetId) {
        return true
      }
    }
    return false
  }

  private sendBrowserEvent(ws: WebSocket, method: string, params: Record<string, unknown>): void {
    if (ws.readyState !== ws.OPEN) {
      return
    }

    ws.send(JSON.stringify({ method, params }))
  }

  private sendAttachedToTarget(
    ws: WebSocket,
    target: CdpTargetSnapshot,
    sessionId: string
  ): void {
    this.sendBrowserEvent(ws, 'Target.attachedToTarget', {
      sessionId,
      targetInfo: this.buildTargetInfo(target, true),
      waitingForDebugger: false
    })
  }

  private emitTargetCreated(target: CdpTargetSnapshot): void {
    for (const [browserClient, clientState] of this.browserClients) {
      if (!clientState.discoverTargets) {
        continue
      }

      this.sendBrowserEvent(browserClient, 'Target.targetCreated', {
        targetInfo: this.buildTargetInfo(target, false)
      })
    }
  }

  private emitTargetInfoChanged(target: CdpTargetSnapshot): void {
    for (const [browserClient, clientState] of this.browserClients) {
      if (!clientState.discoverTargets) {
        continue
      }

      this.sendBrowserEvent(browserClient, 'Target.targetInfoChanged', {
        targetInfo: this.buildTargetInfo(
          target,
          this.isTargetAttachedForClient(target.id, clientState)
        )
      })
    }
  }

  private emitTargetDestroyed(targetId: string): void {
    for (const [browserClient, clientState] of this.browserClients) {
      if (!clientState.discoverTargets) {
        continue
      }

      this.sendBrowserEvent(browserClient, 'Target.targetDestroyed', { targetId })
    }
  }

  private ensureAttachedBrowserSession(
    clientState: BrowserClientState,
    target: CdpTargetRuntime
  ): string | null {
    for (const [sessionId, attachedTargetId] of clientState.sessionToTarget.entries()) {
      if (attachedTargetId === target.id) {
        return null
      }
    }

    const sessionId = this.dependencies.randomId()
    clientState.sessionToTarget.set(sessionId, target.id)
    clientState.autoAttachedSessionIds.add(sessionId)
    target.browserSessionIds.add(sessionId)
    this.ensureDebuggerAttached(target.webContentsId)
    this.emitAutomationStateChanged(target.id)
    return sessionId
  }

  private autoAttachNewTarget(target: CdpTargetRuntime): void {
    for (const [browserClient, clientState] of this.browserClients) {
      if (!clientState.autoAttach || !clientState.flattenMode) {
        continue
      }

      const sessionId = this.ensureAttachedBrowserSession(clientState, target)
      if (!sessionId) {
        continue
      }

      this.sendAttachedToTarget(browserClient, target, sessionId)
    }
  }

  private removeBrowserSessionsForTarget(targetId: string): void {
    for (const [browserClient, clientState] of this.browserClients) {
      const detachedSessionIds = Array.from(clientState.sessionToTarget.entries())
        .filter(([, attachedTargetId]) => attachedTargetId === targetId)
        .map(([sessionId]) => sessionId)

      for (const sessionId of detachedSessionIds) {
        clientState.sessionToTarget.delete(sessionId)
        clientState.autoAttachedSessionIds.delete(sessionId)
      }
    }
  }

  private cleanupBrowserClientSessions(clientState: BrowserClientState): void {
    for (const [sessionId, targetId] of clientState.sessionToTarget) {
      const target = this.targets.get(targetId)
      if (!target) {
        continue
      }

      target.browserSessionIds.delete(sessionId)
      this.detachDebuggerIfUnused(target.webContentsId)
      this.emitAutomationStateChanged(targetId)
    }

    clientState.sessionToTarget.clear()
    clientState.autoAttachedSessionIds.clear()
  }

  private cleanupAutoAttachedSessions(clientState: BrowserClientState): void {
    for (const sessionId of clientState.autoAttachedSessionIds) {
      const targetId = clientState.sessionToTarget.get(sessionId)
      if (!targetId) {
        continue
      }

      clientState.sessionToTarget.delete(sessionId)
      const target = this.targets.get(targetId)
      if (!target) {
        continue
      }

      target.browserSessionIds.delete(sessionId)
      this.detachDebuggerIfUnused(target.webContentsId)
      this.emitAutomationStateChanged(targetId)
    }

    clientState.autoAttachedSessionIds.clear()
  }
}
