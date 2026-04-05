import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { terminalsApi } from '@renderer/lib/ipc'
import { useResolvedTheme } from '@renderer/lib/theme'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { nanoid } from 'nanoid'

interface TerminalPanelProps {
  terminalId: string
  cwd: string
  projectId: string
  workspaceId: string
  autoFocus: boolean
}

function getTerminalTheme(theme: 'light' | 'dark') {
  if (theme === 'light') {
    return {
      background: '#fafaf9',
      foreground: '#171717',
      cursor: '#171717',
      cursorAccent: '#fafaf9',
      selectionBackground: '#2563eb33',
      selectionForeground: '#171717',
      black: '#171717',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#ca8a04',
      blue: '#2563eb',
      magenta: '#7c3aed',
      cyan: '#0891b2',
      white: '#f5f5f4',
      brightBlack: '#737373',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#eab308',
      brightBlue: '#3b82f6',
      brightMagenta: '#8b5cf6',
      brightCyan: '#06b6d4',
      brightWhite: '#ffffff'
    }
  }

  return {
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
  }
}

export function TerminalPanel({
  terminalId,
  cwd,
  projectId,
  workspaceId,
  autoFocus
}: TerminalPanelProps) {
  const resolvedTheme = useResolvedTheme()
  const updatePanelLayout = useWorkspacesStore((state) => state.updatePanelLayout)
  const setPanelFailure = usePanelRuntimeStore((state) => state.setPanelFailure)
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<string | null>(null)
  const mountedRef = useRef(false)

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || mountedRef.current) return
    mountedRef.current = true
    let ptyId = ''
    let term: Terminal | null = null
    let fitAddon: FitAddon | null = null

    try {
      // Generate a unique PTY id per mount to avoid StrictMode conflicts
      ptyId = nanoid()
      ptyIdRef.current = ptyId

      term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontSize: 13,
        fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Cascadia Code', 'Consolas', monospace",
        lineHeight: 1.4,
        theme: getTerminalTheme(resolvedTheme),
        allowProposedApi: true,
        scrollback: 5000
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current)

      termRef.current = term
      fitAddonRef.current = fitAddon
    } catch (error) {
      mountedRef.current = false
      setPanelFailure(terminalId, {
        source: 'async-init',
        summary: 'The terminal failed to initialize.',
        debug:
          error instanceof Error ? error.stack ?? error.message : 'The terminal failed to initialize.',
        occurredAt: Date.now()
      })
      return
    }

    // Fit after opening
    requestAnimationFrame(() => {
      fitAddon?.fit()
      if (autoFocus) {
        term?.focus()
      }
    })

    let inputDisposable: { dispose: () => void } | null = null
    let titleDisposable: { dispose: () => void } | null = null
    let removeDataListener: (() => void) | null = null
    let removeExitListener: (() => void) | null = null

    // Create PTY in main process
    terminalsApi
      .create({ id: ptyId, cwd, projectId, workspaceId })
      .then(() => {
        if (!term) {
          return
        }

        // Send user input to PTY
        inputDisposable = term.onData((data) => {
          terminalsApi.write(ptyId, data)
        })

        titleDisposable = term.onTitleChange((title) => {
          const nextTitle = title.trim()
          if (nextTitle) {
            updatePanelLayout(terminalId, { panelTitle: nextTitle })
          }
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
        setPanelFailure(terminalId, {
          source: 'async-init',
          summary: 'The terminal process could not be started.',
          debug: err instanceof Error ? err.stack ?? err.message : 'Failed to create terminal.',
          occurredAt: Date.now()
        })
      })

    return () => {
      inputDisposable?.dispose()
      titleDisposable?.dispose()
      removeDataListener?.()
      removeExitListener?.()
      terminalsApi.close(ptyId).catch(() => {})
      term?.dispose()
      termRef.current = null
      fitAddonRef.current = null
      ptyIdRef.current = null
      mountedRef.current = false
    }
  }, [cwd, projectId, resolvedTheme, setPanelFailure, terminalId, updatePanelLayout, workspaceId])

  useEffect(() => {
    if (!autoFocus) {
      return
    }

    requestAnimationFrame(() => {
      termRef.current?.focus()
    })
  }, [autoFocus])

  useEffect(() => {
    if (!termRef.current || !containerRef.current) {
      return
    }

    termRef.current.options.theme = getTerminalTheme(resolvedTheme)
    containerRef.current.style.backgroundColor =
      resolvedTheme === 'light' ? '#fafaf9' : '#0a0a0a'
  }, [resolvedTheme])

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
      style={{
        padding: '8px 0 0 8px',
        backgroundColor: resolvedTheme === 'light' ? '#fafaf9' : '#0a0a0a'
      }}
    />
  )
}
