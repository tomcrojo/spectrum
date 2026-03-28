import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { terminalsApi } from '@renderer/lib/ipc'
import { nanoid } from 'nanoid'

interface TerminalPanelProps {
  terminalId: string
  cwd: string
  projectId: string
  workspaceId: string
}

export function TerminalPanel({
  terminalId: _externalId,
  cwd,
  projectId,
  workspaceId
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<string | null>(null)
  const mountedRef = useRef(false)

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || mountedRef.current) return
    mountedRef.current = true

    // Generate a unique PTY id per mount to avoid StrictMode conflicts
    const ptyId = nanoid()
    ptyIdRef.current = ptyId

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Cascadia Code', 'Consolas', monospace",
      lineHeight: 1.4,
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#e5e5e5',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#3b82f640',
        selectionForeground: '#e5e5e5',
        black: '#0a0a0a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#e5e5e5',
        brightBlack: '#525252',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      allowProposedApi: true,
      scrollback: 5000
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Fit after opening
    requestAnimationFrame(() => {
      fitAddon.fit()
    })

    let inputDisposable: { dispose: () => void } | null = null
    let removeDataListener: (() => void) | null = null
    let removeExitListener: (() => void) | null = null

    // Create PTY in main process
    terminalsApi
      .create({ id: ptyId, cwd, projectId, workspaceId })
      .then(() => {
        // Send user input to PTY
        inputDisposable = term.onData((data) => {
          terminalsApi.write(ptyId, data)
        })

        // Receive PTY output
        removeDataListener = terminalsApi.onData(
          ptyId,
          (data: string) => {
            term.write(data)
          }
        )

        // Handle PTY exit
        removeExitListener = terminalsApi.onExit(
          ptyId,
          (_exitCode: number) => {
            term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n')
          }
        )
      })
      .catch((err) => {
        term.write(`\x1b[31mFailed to create terminal: ${err.message}\x1b[0m\r\n`)
      })

    return () => {
      inputDisposable?.dispose()
      removeDataListener?.()
      removeExitListener?.()
      terminalsApi.close(ptyId).catch(() => {})
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      ptyIdRef.current = null
      mountedRef.current = false
    }
  }, [cwd, projectId, workspaceId])

  // Handle resize
  const handleResize = useCallback(() => {
    if (fitAddonRef.current && termRef.current && ptyIdRef.current) {
      fitAddonRef.current.fit()
      const { cols, rows } = termRef.current
      terminalsApi.resize(ptyIdRef.current, cols, rows).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      handleResize()
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [handleResize])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: '8px 0 0 8px' }}
    />
  )
}
