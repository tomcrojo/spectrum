/**
 * Transport adapter — detects whether we're running inside Electron
 * (window.api exists) or a regular browser (use WebSocket to dev server).
 *
 * Provides the same { invoke, on, once } interface in both cases.
 */

type Listener = (...args: any[]) => void

interface Transport {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  on: (channel: string, callback: Listener) => () => void
  once: (channel: string, callback: Listener) => void
}

// ─── Electron transport (just proxies to window.api) ─────────────────

function createElectronTransport(): Transport {
  return window.api
}

// ─── WebSocket transport (connects to dev server) ────────────────────

function createWsTransport(): Transport {
  let ws: WebSocket | null = null
  let messageId = 0
  const pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void }
  >()
  const listeners = new Map<string, Set<Listener>>()
  let connectPromise: Promise<void> | null = null
  let reconnectTimer: number | null = null
  const wsUrl =
    import.meta.env.VITE_DEV_SERVER_WS_URL ?? 'ws://localhost:3001'

  function scheduleReconnect() {
    if (reconnectTimer !== null) return
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      void connect().catch(() => {})
    }, 1000)
  }

  function connect(): Promise<void> {
    if (ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }
    if (connectPromise) return connectPromise

    connectPromise = new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl)
      let opened = false

      socket.onopen = () => {
        ws = socket
        opened = true
        connectPromise = null
        console.log(`[transport] Connected to dev server at ${wsUrl}`)
        resolve()
      }

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          // Terminal streaming events
          if (msg.type === 'terminal:data') {
            const key = `terminal:data:${msg.id}`
            const set = listeners.get(key)
            if (set) set.forEach((cb) => cb(msg.data))
            return
          }
          if (msg.type === 'terminal:exit') {
            const key = `terminal:exit:${msg.id}`
            const set = listeners.get(key)
            if (set) set.forEach((cb) => cb(msg.exitCode))
            return
          }

          // Request-response
          const p = pending.get(msg.id)
          if (p) {
            pending.delete(msg.id)
            if (msg.error) {
              p.reject(new Error(msg.error))
            } else {
              p.resolve(msg.result)
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      socket.onclose = () => {
        if (ws === socket) {
          ws = null
        }
        connectPromise = null

        if (!opened) {
          reject(new Error(`Failed to connect to dev server at ${wsUrl}`))
        } else {
          console.log('[transport] Disconnected from dev server')
        }

        // Reject all pending requests
        for (const [, p] of pending) {
          p.reject(new Error('WebSocket disconnected'))
        }
        pending.clear()

        scheduleReconnect()
      }

      socket.onerror = () => {
        if (!opened) {
          console.warn(`[transport] Unable to connect to ${wsUrl}`)
        }
      }
    })

    return connectPromise
  }

  // Start connecting immediately
  void connect().catch(() => {})

  return {
    invoke: async (channel: string, ...args: any[]) => {
      await connect()
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected')
      }

      const id = ++messageId

      // Flatten args for single-arg channels
      let payload: any
      if (args.length === 0) {
        payload = undefined
      } else if (args.length === 1) {
        payload = args[0]
      } else {
        payload = args
      }

      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        ws!.send(JSON.stringify({ id, channel, args: payload }))
      })
    },

    on: (channel: string, callback: Listener) => {
      if (!listeners.has(channel)) {
        listeners.set(channel, new Set())
      }
      listeners.get(channel)!.add(callback)

      return () => {
        const set = listeners.get(channel)
        if (set) {
          set.delete(callback)
          if (set.size === 0) listeners.delete(channel)
        }
      }
    },

    once: (channel: string, callback: Listener) => {
      const wrapped: Listener = (...args) => {
        remove()
        callback(...args)
      }
      const remove = transport.on(channel, wrapped)
    }
  }
}

// ─── Auto-detect and export ──────────────────────────────────────────

const isElectron = typeof window !== 'undefined' && !!window.api

export const transport: Transport = isElectron
  ? createElectronTransport()
  : createWsTransport()
