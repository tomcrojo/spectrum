import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@renderer/lib/cn'
import { useResolvedTheme } from '@renderer/lib/theme'
import { useUiStore } from '@renderer/stores/ui.store'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { TerminalPanel } from './TerminalPanel'
import { T3CodePanel } from './T3CodePanel'
import { BrowserPanel } from './BrowserPanel'
import { FilePanel } from './FilePanel'
import { PanelPlaceholder } from './PanelPlaceholder'
import { PanelGlyph } from '@renderer/components/shared/PanelIcons'
import type { PanelHydrationState, PanelType } from '@shared/workspace.types'

const PANEL_FOCUS_HIT_AREA_PX = 7

interface WorkspacePanelProps {
  workspaceId: string
  workspaceName: string
  projectId: string
  projectName: string
  cwd: string
  panelType: PanelType
  panelTitle: string
  filePath?: string
  cursorLine?: number
  cursorColumn?: number
  panelId: string
  providerId?: string
  t3ProjectId?: string
  t3ThreadId?: string
  hydrationState: PanelHydrationState
  isFocused: boolean
  isActiveWorkspace: boolean
  onClose: () => void
  style?: React.CSSProperties
  initialWidth?: number
  initialHeight?: number
  initialUrl?: string
}

function getPanelLabel(panelType: PanelType, panelTitle: string) {
  const trimmed = panelTitle.trim()
  if (trimmed) {
    return trimmed
  }

  if (panelType === 't3code') return 'T3Code'
  if (panelType === 'browser') return 'Browser'
  if (panelType === 'file') return 'Files'
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

function PanelFocusHitArea({
  panelId,
  revealPanel,
  setFocusedPanel,
  autoCenterFocusedPanel
}: {
  panelId: string
  revealPanel: () => void
  setFocusedPanel: (panelId: string | null) => void
  autoCenterFocusedPanel: boolean
}) {
  const focusPanel = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      setFocusedPanel(panelId)
      if (autoCenterFocusedPanel) {
        revealPanel()
      }
    },
    [autoCenterFocusedPanel, panelId, revealPanel, setFocusedPanel]
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div aria-hidden="true" className="pointer-events-auto absolute inset-x-0 top-0" style={{ height: PANEL_FOCUS_HIT_AREA_PX }} onMouseDown={focusPanel} />
      <div aria-hidden="true" className="pointer-events-auto absolute inset-y-0 left-0" style={{ width: PANEL_FOCUS_HIT_AREA_PX }} onMouseDown={focusPanel} />
      <div aria-hidden="true" className="pointer-events-auto absolute inset-y-0 right-0" style={{ width: PANEL_FOCUS_HIT_AREA_PX }} onMouseDown={focusPanel} />
      <div aria-hidden="true" className="pointer-events-auto absolute inset-x-0 bottom-0" style={{ height: PANEL_FOCUS_HIT_AREA_PX }} onMouseDown={focusPanel} />
    </div>
  )
}

function WorkspacePanelImpl({
  workspaceId,
  projectId,
  projectName,
  cwd,
  panelType,
  panelTitle,
  filePath,
  cursorLine,
  cursorColumn,
  panelId,
  providerId,
  t3ProjectId,
  t3ThreadId,
  hydrationState,
  isFocused,
  isActiveWorkspace,
  onClose,
  style,
  initialWidth,
  initialHeight,
  initialUrl
}: WorkspacePanelProps) {
  const resolvedTheme = useResolvedTheme()
  const autoCenterFocusedPanel = useUiStore((state) => state.autoCenterFocusedPanel)
  const updatePanelLayout = useWorkspacesStore((state) => state.updatePanelLayout)
  const setFocusedPanel = useWorkspacesStore((state) => state.setFocusedPanel)
  const isDirty = useWorkspacesStore((state) => Boolean(state.dirtyPanelIds[panelId]))
  const markPanelVisible = usePanelRuntimeStore((state) => state.markPanelVisible)
  const [isResizing, setIsResizing] = useState(false)
  const defaultWidth = panelType === 't3code' || panelType === 'chat' ? 400 : 700
  const [size, setSize] = useState(() => ({
    width: initialWidth ?? defaultWidth,
    height:
      initialHeight ??
      (typeof window === 'undefined' ? 450 : Math.max(250, Math.round(window.innerHeight * 0.8)))
  }))
  const panelRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0, w: 0, h: 0 })
  const revealAnimationFrameRef = useRef<number | null>(null)
  const panelLabel = getPanelLabel(panelType, panelTitle)

  const revealPanel = useCallback(() => {
    const panelElement = panelRef.current
    if (!panelElement) {
      return
    }

    const scrollContainer = findScrollContainer(panelElement)
    if (!scrollContainer) {
      panelElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      return
    }

    const panelRect = panelElement.getBoundingClientRect()
    const containerRect = scrollContainer.getBoundingClientRect()
    const zoom = useUiStore.getState().canvasZoom
    const panelOffsetLeft = (panelRect.left - containerRect.left) / zoom + scrollContainer.scrollLeft
    const panelOffsetTop = (panelRect.top - containerRect.top) / zoom + scrollContainer.scrollTop
    const panelWidth = panelRect.width / zoom
    const panelHeight = panelRect.height / zoom
    const nextScrollLeft = panelOffsetLeft - (scrollContainer.clientWidth / zoom - panelWidth) / 2
    const nextScrollTop = panelOffsetTop - (scrollContainer.clientHeight / zoom - panelHeight) / 2
    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth)
    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
    const targetScrollLeft = Math.min(maxScrollLeft, Math.max(0, nextScrollLeft))
    const targetScrollTop = Math.min(maxScrollTop, Math.max(0, nextScrollTop))
    const startScrollLeft = scrollContainer.scrollLeft
    const startScrollTop = scrollContainer.scrollTop
    const deltaX = targetScrollLeft - startScrollLeft
    const deltaY = targetScrollTop - startScrollTop

    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
      scrollContainer.scrollTo({ left: targetScrollLeft, top: targetScrollTop })
      return
    }

    if (revealAnimationFrameRef.current !== null) {
      cancelAnimationFrame(revealAnimationFrameRef.current)
    }

    const durationMs = 160
    const animationStart = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - animationStart
      const progress = Math.min(1, elapsed / durationMs)

      scrollContainer.scrollTo({
        left: startScrollLeft + deltaX * progress,
        top: startScrollTop + deltaY * progress
      })

      if (progress < 1) {
        revealAnimationFrameRef.current = requestAnimationFrame(animate)
      } else {
        revealAnimationFrameRef.current = null
      }
    }

    revealAnimationFrameRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    return () => {
      if (revealAnimationFrameRef.current !== null) {
        cancelAnimationFrame(revealAnimationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isFocused) {
      return
    }

    markPanelVisible(panelId)
    requestAnimationFrame(() => {
      if (autoCenterFocusedPanel) {
        revealPanel()
      }

      if (panelType === 'chat' || panelType === 'browser') {
        panelRef.current?.focus({ preventScroll: true })
      }
    })
  }, [autoCenterFocusedPanel, isFocused, markPanelVisible, panelId, panelType, revealPanel])

  const onResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setIsResizing(true)
      startPos.current = { x: event.clientX, y: event.clientY, w: size.width, h: size.height }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startPos.current.x
        const dy = moveEvent.clientY - startPos.current.y
        setSize({
          width: Math.max(400, startPos.current.w + dx),
          height: Math.max(250, startPos.current.h + dy)
        })
      }

      const onMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [size.height, size.width]
  )

  const wasResizingRef = useRef(false)
  useEffect(() => {
    if (isResizing) {
      wasResizingRef.current = true
      return
    }

    if (!wasResizingRef.current) {
      return
    }

    wasResizingRef.current = false
    updatePanelLayout(panelId, { width: size.width, height: size.height })
  }, [isResizing, panelId, size.height, size.width, updatePanelLayout])

  const watchPriority =
    isFocused && isActiveWorkspace ? 'focused' : isActiveWorkspace ? 'active' : 'inactive'

  return (
    <div
      ref={panelRef}
      data-panel-root="true"
      data-panel-id={panelId}
      tabIndex={-1}
      onMouseDown={() => {
        setFocusedPanel(panelId)
        markPanelVisible(panelId)
        if (autoCenterFocusedPanel) {
          revealPanel()
        }
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
      <div className="flex h-8 items-center justify-between gap-2 rounded-t-lg border-b border-border-subtle bg-bg-raised px-2.5 flex-shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <PanelGlyph panelType={panelType} providerId={providerId} className="text-text-secondary" />
          <span className="truncate text-xs font-medium text-text-primary">{panelLabel}</span>
          {isDirty ? (
            <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
              Dirty
            </span>
          ) : null}
        </div>
        <button onClick={onClose} className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary">
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <PanelFocusHitArea
          panelId={panelId}
          revealPanel={revealPanel}
          setFocusedPanel={setFocusedPanel}
          autoCenterFocusedPanel={autoCenterFocusedPanel}
        />
        {panelType === 't3code' ? (
          <T3CodePanel
            panelId={panelId}
            workspaceId={workspaceId}
            projectId={projectId}
            projectName={projectName}
            projectPath={cwd}
            t3ProjectId={t3ProjectId}
            t3ThreadId={t3ThreadId}
            theme={resolvedTheme}
            autoFocus={isFocused}
            hydrationState={hydrationState === 'preview' ? 'cold' : hydrationState}
            watchPriority={watchPriority}
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
            hydrationState={hydrationState}
          />
        ) : panelType === 'file' ? (
          <FilePanel
            panelId={panelId}
            workspaceId={workspaceId}
            projectId={projectId}
            projectPath={cwd}
            initialFilePath={filePath}
            initialCursorLine={cursorLine}
            initialCursorColumn={cursorColumn}
            autoFocus={isFocused}
          />
        ) : (
          <PanelPlaceholder type={panelType} />
        )}
      </div>

      <div onMouseDown={onResizeStart} className="absolute bottom-0 right-0 z-20 h-6 w-6 cursor-se-resize" style={{ touchAction: 'none' }}>
        <svg className="absolute bottom-1 right-1 h-3 w-3 text-text-muted opacity-30" viewBox="0 0 12 12" fill="none">
          <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

export const WorkspacePanel = memo(WorkspacePanelImpl)
