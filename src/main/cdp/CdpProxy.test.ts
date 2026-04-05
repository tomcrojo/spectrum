import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { CdpProxy, type CdpTargetSnapshot } from './CdpProxy'

interface MockDebuggerCall {
  method: string
  params: Record<string, unknown>
}

interface MockWebContentsRecord {
  debugger: {
    isAttached(): boolean
    attach(protocolVersion: string): void
    detach(): void
    sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>
    on(event: 'message', listener: (...args: unknown[]) => void): void
    removeListener(event: 'message', listener: (...args: unknown[]) => void): void
  }
  calls: MockDebuggerCall[]
  attachCalls: number
  detachCalls: number
}

function createMockWebContentsStore() {
  const records = new Map<number, MockWebContentsRecord>()

  return {
    getRecord(webContentsId: number): MockWebContentsRecord {
      let record = records.get(webContentsId)
      if (record) {
        return record
      }

      let attached = false
      const emitter = new EventEmitter()
      const calls: MockDebuggerCall[] = []
      let attachCalls = 0
      let detachCalls = 0

      record = {
        debugger: {
          isAttached: () => attached,
          attach: () => {
            attached = true
            attachCalls += 1
          },
          detach: () => {
            attached = false
            detachCalls += 1
          },
          sendCommand: async (method, params = {}) => {
            calls.push({ method, params })
            return { ok: true, method, params }
          },
          on: (event, listener) => {
            emitter.on(event, listener)
          },
          removeListener: (event, listener) => {
            emitter.removeListener(event, listener)
          }
        },
        calls,
        get attachCalls() {
          return attachCalls
        },
        get detachCalls() {
          return detachCalls
        }
      }

      records.set(webContentsId, record)
      return record
    }
  }
}

async function connectBrowserSocket(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/devtools/browser/test-browser`)
  const events: Array<Record<string, unknown>> = []
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: unknown): void }>()

  ws.on('message', (raw) => {
    const payload = JSON.parse(raw.toString()) as Record<string, unknown>
    if (typeof payload.id === 'number') {
      const waiter = pending.get(payload.id)
      if (!waiter) {
        return
      }
      pending.delete(payload.id)
      if (payload.error) {
        waiter.reject(new Error(String((payload.error as { message?: string }).message ?? 'CDP error')))
      } else {
        waiter.resolve(payload.result)
      }
      return
    }

    events.push(payload)
  })

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })

  let nextId = 1

  return {
    ws,
    events,
    async sendCommand(
      method: string,
      params: Record<string, unknown> = {},
      sessionId?: string
    ): Promise<unknown> {
      const id = nextId
      nextId += 1
      const payload: Record<string, unknown> = { id, method, params }
      if (sessionId) {
        payload.sessionId = sessionId
      }

      const resultPromise = new Promise<unknown>((resolve, reject) => {
        pending.set(id, { resolve, reject })
      })

      ws.send(JSON.stringify(payload))
      return resultPromise
    },
    async waitForEvent(method: string): Promise<Record<string, unknown>> {
      const started = Date.now()

      while (Date.now() - started < 2_000) {
        const index = events.findIndex((entry) => entry.method === method)
        if (index >= 0) {
          return events.splice(index, 1)[0] as Record<string, unknown>
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      throw new Error(`Timed out waiting for ${method}`)
    },
    close() {
      ws.close()
    }
  }
}

function createTarget(overrides: Partial<CdpTargetSnapshot> = {}): CdpTargetSnapshot {
  return {
    id: overrides.id ?? 'target-1',
    title: overrides.title ?? 'Initial title',
    url: overrides.url ?? 'https://example.com',
    webContentsId: overrides.webContentsId ?? 101
  }
}

test('serves normalized CDP discovery routes', async () => {
  const store = createMockWebContentsStore()
  const proxy = new CdpProxy('workspace-http', undefined, {
    getWebContentsById: (id) => store.getRecord(id),
    randomId: () => 'ignored'
  })

  const port = await proxy.start()
  proxy.registerTarget(createTarget())

  const version = (await fetch(`http://127.0.0.1:${port}/json/version`).then((response) =>
    response.json()
  )) as { webSocketDebuggerUrl: string }
  const versionWithSlash = (await fetch(`http://127.0.0.1:${port}/json/version/`).then(
    (response) => response.json()
  )) as { webSocketDebuggerUrl: string }
  const list = (await fetch(`http://127.0.0.1:${port}/json/list/`).then((response) =>
    response.json()
  )) as Array<{ id: string }>
  const jsonRoot = (await fetch(`http://127.0.0.1:${port}/json/?foo=bar`).then((response) =>
    response.json()
  )) as Array<{ id: string }>
  const notFound = await fetch(`http://127.0.0.1:${port}/missing`)

  assert.equal(typeof version.webSocketDebuggerUrl, 'string')
  assert.deepEqual(versionWithSlash, version)
  assert.equal(list.length, 1)
  assert.equal(jsonRoot.length, 1)
  assert.equal(notFound.status, 404)

  await proxy.shutdown()
})

test('emits target lifecycle events for discovery-enabled clients', async () => {
  const store = createMockWebContentsStore()
  let nextId = 1
  const proxy = new CdpProxy('workspace-discovery', undefined, {
    getWebContentsById: (id) => store.getRecord(id),
    randomId: () => `session-${nextId++}`
  })

  const port = await proxy.start()
  proxy.registerTarget(createTarget())

  const client = await connectBrowserSocket(port)

  await client.sendCommand('Target.setDiscoverTargets', { discover: true })
  const existingCreated = await client.waitForEvent('Target.targetCreated')
  assert.equal(
    (existingCreated.params as { targetInfo: { targetId: string } }).targetInfo.targetId,
    'target-1'
  )

  proxy.registerTarget(createTarget({ id: 'target-2', title: 'Second title', webContentsId: 202 }))
  const newCreated = await client.waitForEvent('Target.targetCreated')
  assert.equal(
    (newCreated.params as { targetInfo: { targetId: string } }).targetInfo.targetId,
    'target-2'
  )

  proxy.registerTarget(createTarget({ title: 'Updated title', url: 'https://example.com/updated' }))
  const infoChanged = await client.waitForEvent('Target.targetInfoChanged')
  assert.equal(
    (infoChanged.params as { targetInfo: { title: string } }).targetInfo.title,
    'Updated title'
  )

  proxy.unregisterTarget('target-2')
  const destroyed = await client.waitForEvent('Target.targetDestroyed')
  assert.equal((destroyed.params as { targetId: string }).targetId, 'target-2')

  client.close()
  await proxy.shutdown()
})

test('supports flattened auto-attach and target-scoped command routing', async () => {
  const store = createMockWebContentsStore()
  let nextId = 1
  const proxy = new CdpProxy('workspace-auto-attach', undefined, {
    getWebContentsById: (id) => store.getRecord(id),
    randomId: () => `session-${nextId++}`
  })

  const port = await proxy.start()
  proxy.registerTarget(createTarget())

  const client = await connectBrowserSocket(port)
  await client.sendCommand('Target.setDiscoverTargets', { discover: true })
  await client.waitForEvent('Target.targetCreated')

  await client.sendCommand('Target.setAutoAttach', {
    autoAttach: true,
    flatten: true,
    waitForDebuggerOnStart: false
  })

  const attached = await client.waitForEvent('Target.attachedToTarget')
  const attachedParams = attached.params as {
    sessionId: string
    targetInfo: { targetId: string; attached: boolean }
  }

  assert.equal(attachedParams.targetInfo.targetId, 'target-1')
  assert.equal(attachedParams.targetInfo.attached, true)

  const targets = (await client.sendCommand('Target.getTargets')) as {
    targetInfos: Array<{ targetId: string; attached: boolean }>
  }
  assert.deepEqual(targets.targetInfos, [
    {
      targetId: 'target-1',
      type: 'page',
      title: 'Initial title',
      url: 'https://example.com',
      attached: true,
      browserContextId: 'default'
    }
  ])

  const sessionResult = (await client.sendCommand(
    'Page.enable',
    {},
    attachedParams.sessionId
  )) as { ok: boolean; method: string }
  assert.equal(sessionResult.ok, true)
  assert.equal(sessionResult.method, 'Page.enable')

  const webContentsRecord = store.getRecord(101)
  assert.equal(webContentsRecord.attachCalls > 0, true)
  assert.equal(webContentsRecord.calls.at(-1)?.method, 'Page.enable')

  client.close()
  await proxy.shutdown()
})

test('auto-attaches new targets and ignores non-flatten auto-attach', async () => {
  const store = createMockWebContentsStore()
  let nextId = 1
  const proxy = new CdpProxy('workspace-auto-attach-new-target', undefined, {
    getWebContentsById: (id) => store.getRecord(id),
    randomId: () => `session-${nextId++}`
  })

  const port = await proxy.start()
  const client = await connectBrowserSocket(port)

  await client.sendCommand('Target.setDiscoverTargets', { discover: true })
  await client.sendCommand('Target.setAutoAttach', {
    autoAttach: true,
    flatten: false,
    waitForDebuggerOnStart: false
  })

  proxy.registerTarget(createTarget())
  const created = await client.waitForEvent('Target.targetCreated')
  assert.equal(
    (created.params as { targetInfo: { targetId: string } }).targetInfo.targetId,
    'target-1'
  )

  const nonFlattenTargets = (await client.sendCommand('Target.getTargets')) as {
    targetInfos: Array<{ targetId: string; attached: boolean }>
  }
  assert.equal(nonFlattenTargets.targetInfos[0]?.attached, false)

  await client.sendCommand('Target.setAutoAttach', {
    autoAttach: true,
    flatten: true,
    waitForDebuggerOnStart: false
  })
  const existingAttached = await client.waitForEvent('Target.attachedToTarget')
  assert.equal(
    (existingAttached.params as { targetInfo: { targetId: string } }).targetInfo.targetId,
    'target-1'
  )

  proxy.registerTarget(createTarget({ id: 'target-2', webContentsId: 202 }))
  await client.waitForEvent('Target.targetCreated')
  const attached = await client.waitForEvent('Target.attachedToTarget')
  assert.equal(
    (attached.params as { targetInfo: { targetId: string } }).targetInfo.targetId,
    'target-2'
  )

  client.close()
  await proxy.shutdown()
})

test('logs and preserves empty results for unhandled browser commands', async () => {
  const store = createMockWebContentsStore()
  const proxy = new CdpProxy('workspace-unhandled', undefined, {
    getWebContentsById: (id) => store.getRecord(id),
    randomId: () => 'session-1'
  })

  const warnCalls: unknown[][] = []
  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args)
  }

  try {
    const port = await proxy.start()
    const client = await connectBrowserSocket(port)

    const result = await client.sendCommand('Fake.unknownMethod', { foo: 'bar', baz: true })
    assert.deepEqual(result, {})
    assert.equal(warnCalls.length, 1)
    assert.equal(warnCalls[0]?.[0], '[CdpProxy] Unhandled CDP command: Fake.unknownMethod')
    assert.deepEqual(warnCalls[0]?.[1], {
      params: ['foo', 'baz']
    })

    client.close()
    await proxy.shutdown()
  } finally {
    console.warn = originalWarn
  }
})
