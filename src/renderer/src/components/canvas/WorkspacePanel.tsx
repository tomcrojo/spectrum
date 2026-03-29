import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@renderer/lib/cn'
import { useResolvedTheme } from '@renderer/lib/theme'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { TerminalPanel } from './TerminalPanel'
import { T3CodePanel } from './T3CodePanel'
import { BrowserPanel } from './BrowserPanel'
import { PanelPlaceholder } from './PanelPlaceholder'
import type { PanelType } from '@shared/workspace.types'

interface WorkspacePanelProps {
  workspaceId: string
  workspaceName: string
  projectId: string
  cwd: string
  panelType: PanelType
  panelTitle: string
  panelId: string
  onClose: () => void
  style?: React.CSSProperties
  /** Restored width from saved state */
  initialWidth?: number
  /** Restored height from saved state */
  initialHeight?: number
  /** Restored URL from saved state (browser panels) */
  initialUrl?: string
}

function PanelTypeIcon({ panelType }: { panelType: PanelType }) {
  if (panelType === 'terminal') {
    return (
      <svg
        className="h-3.5 w-3.5 text-text-secondary"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 4.5L6.5 8L3 11.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 11.5H13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (panelType === 'browser') {
    return (
      <svg
        className="h-3.5 w-3.5 text-text-secondary"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M2.8 6H13.2M2.8 10H13.2M8 2.5C9.5 4 10.4 5.9 10.4 8C10.4 10.1 9.5 12 8 13.5C6.5 12 5.6 10.1 5.6 8C5.6 5.9 6.5 4 8 2.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg
      className="h-3.5 w-3.5 text-text-secondary"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.5 4.5H11.5C12.3284 4.5 13 5.17157 13 6V10C13 10.8284 12.3284 11.5 11.5 11.5H7.5L4.5 13V11.5H4.5C3.67157 11.5 3 10.8284 3 10V6C3 5.17157 3.67157 4.5 4.5 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getPanelLabel(panelType: PanelType, panelTitle: string) {
  const trimmed = panelTitle.trim()
  if (trimmed) {
    return trimmed
  }

  if (panelType === 't3code') return 'T3Code'
  if (panelType === 'browser') return 'Browser'
  if (panelType === 'chat') return 'Chat'
  return 'Terminal'
}

function findScrollContainer(element: HTMLElement): HTMLElement | null {
  const canvasRoot = element.closest('[data-canvas-scroll-root="true"]')
  if (canvasRoot instanceof HTMLElement) {
    return canvasRoot
  }

  let parent = element.parentElement

  while (parent) {
    if (parent.scrollWidth > parent.clientWidth || parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }

  return null
}

export function WorkspacePanel({
  workspaceId,
  projectId,
  cwd,
  panelType,
  panelTitle,
  panelId,
  onClose,
  style,
  initialWidth,
  initialHeight,
  initialUrl
}: WorkspacePanelProps) {
  const resolvedTheme = useResolvedTheme()
  const updatePanel = useWorkspacesStore((s) => s.updatePanel)
  const setFocusedPanel = useWorkspacesStore((s) => s.setFocusedPanel)
  const isFocused = useWorkspacesStore((s) => s.focusedPanelId === panelId)
  const [isResizing, setIsResizing] = useState(false)
  const [size, setSize] = useState(() => ({
    width: initialWidth ?? 700,
    height:
      initialHeight ??
      (typeof window === 'undefined'
        ? 450
        : Math.max(250, Math.round(window.innerHeight * 0.8)))
  }))
  const panelRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const panelLabel = getPanelLabel(panelType, panelTitle)
  const revealPanel = useCallback(() => {
    const panelElement = panelRef.current
    if (!panelElement) return

    const scrollContainer = findScrollContainer(panelElement)
    if (!scrollContainer) {
      panelElement.scrollIntoView({
        block: 'center',
        inline: 'center'
      })
      return
    }
    const panelRect = panelElement.getBoundingClientRect()
    const containerRect = scrollContainer.getBoundingClientRect()
    const panelOffsetLeft = panelRect.left - containerRect.left + scrollContainer.scrollLeft
    const panelOffsetTop = panelRect.top - containerRect.top + scrollContainer.scrollTop
    const nextScrollLeft =
      panelOffsetLeft - (scrollContainer.clientWidth - panelRect.width) / 2
    const nextScrollTop =
      panelOffsetTop - (scrollContainer.clientHeight - panelRect.height) / 2
    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth)
    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)

    scrollContainer.scrollTo({
      left: Math.min(maxScrollLeft, Math.max(0, nextScrollLeft)),
      top: Math.min(maxScrollTop, Math.max(0, nextScrollTop))
    })
  }, [])

  useEffect(() => {
    if (!isFocused) return

    requestAnimationFrame(() => {
      revealPanel()

      if (panelType === 'chat' || panelType === 'browser') {
        panelRef.current?.focus({ preventScroll: true })
      }
    })
  }, [isFocused, panelType, revealPanel])

  // Focus this panel when user clicks into it — including iframe/terminal content.
  // Iframes swallow mouse events, so we also listen for focusin on the container
  // and use a window-level blur→focus cycle detection.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return

    const handleFocusIn = () => {
      setFocusedPanel(panelId)
      revealPanel()
    }
    el.addEventListener('focusin', handleFocusIn)

    // Detect iframe click: when the window blurs (focus moves into an iframe inside
    // this panel), we mark this panel as focused.
    const handleWindowBlur = () => {
      // Use rAF so the active element has settled
      requestAnimationFrame(() => {
        if (!el) return
        // Check if the iframe that received focus is within this panel
        const activeEl = document.activeElement
        if (activeEl && el.contains(activeEl)) {
          setFocusedPanel(panelId)
          revealPanel()
        }
      })
    }
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      el.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [panelId, revealPanel, setFocusedPanel])

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      startPos.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startPos.current.x
        const dy = ev.clientY - startPos.current.y
        const newWidth = Math.max(400, startPos.current.w + dx)
        const newHeight = Math.max(250, startPos.current.h + dy)
        setSize({ width: newWidth, height: newHeight })
      }

      const onMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        // Persist final size after resize ends
        updatePanel(panelId, { width: size.width, height: size.height })
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [size, panelId, updatePanel]
  )

  // Persist size after resize finishes (onMouseUp captures stale size from closure,
  // so we also use an effect that fires when resizing stops)
  const wasResizingRef = useRef(false)
  useEffect(() => {
    if (isResizing) {
      wasResizingRef.current = true
    } else if (wasResizingRef.current) {
      wasResizingRef.current = false
      updatePanel(panelId, { width: size.width, height: size.height })
    }
  }, [isResizing, size.width, size.height, panelId, updatePanel])

  return (
    <div
      ref={panelRef}
      data-panel-root="true"
      tabIndex={-1}
      onMouseDown={() => {
        setFocusedPanel(panelId)
        revealPanel()
      }}
      className={cn(
        'relative flex flex-col rounded-lg border',
        isFocused ? 'border-accent/50' : 'border-border',
        'bg-bg shadow-lg shadow-black/30',
        isResizing && 'select-none'
      )}
      style={{
        width: size.width,
        height: size.height,
        ...style
      }}
    >
      {/* Title bar */}
      <div className="flex h-8 items-center justify-between gap-2 rounded-t-lg border-b border-border-subtle bg-bg-raised px-2.5 flex-shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <PanelTypeIcon panelType={panelType} />
          <span className="truncate text-xs font-medium text-text-primary">
            {panelLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3L9 9M9 3L3 9"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {panelType === 't3code' ? (
          <T3CodePanel
            panelId={panelId}
            workspaceId={workspaceId}
            projectId={projectId}
            projectPath={cwd}
            theme={resolvedTheme}
            autoFocus={isFocused}
          />
        ) : panelType === 'terminal' ? (
          <TerminalPanel
            terminalId={panelId}
            cwd={cwd}
            projectId={projectId}
            workspaceId={workspaceId}
            autoFocus={isFocused}
          />
        ) : panelType === 'browser' ? (
          <BrowserPanel
            panelId={panelId}
            workspaceId={workspaceId}
            projectId={projectId}
            initialUrl={initialUrl}
            autoFocus={isFocused}
            isResizing={isResizing}
          />
        ) : (
          <PanelPlaceholder type={panelType} />
        )}
      </div>

      {/* Resize handle — bottom-right corner */}
      <div
        onMouseDown={onResizeStart}
        className="absolute bottom-0 right-0 h-6 w-6 cursor-se-resize z-10"
        style={{ touchAction: 'none' }}
      >
        <svg
          className="absolute bottom-1 right-1 h-3 w-3 text-text-muted opacity-30"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M10 2L2 10M10 6L6 10M10 10L10 10"
            stroke="currentColor"
            strokeWidth={1}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}
