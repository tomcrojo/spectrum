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
import { PanelContentHost } from './PanelContentHost'
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
  browserRuntimeHostEnabled: boolean
}

interface FilePanelChromeState {
  relativePath: string | null
  isExplorerCollapsed: boolean
  canSave: boolean
  canReload: boolean
  isSaving: boolean
  onSave: (() => void) | null
  onReload: (() => void) | null
  onToggleExplorer: (() => void) | null
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

function PanelIconButton({
  label,
  onClick,
  disabled = false,
  children
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md',
        'text-text-secondary transition-colors',
        'hover:bg-bg-hover hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        'disabled:pointer-events-none disabled:opacity-45'
      )}
    >
      {children}
    </button>
  )
}

function BrowserAutomationBadge() {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-text-muted/25 bg-bg px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted"
      title="This browser is currently being operated by an agent"
    >
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M2.8 6H13.2M2.8 10H13.2M8 2.5C9.5 4 10.4 5.9 10.4 8C10.4 10.1 9.5 12 8 13.5C6.5 12 5.6 10.1 5.6 8C5.6 5.9 6.5 4 8 2.5Z"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="4" y="5.5" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 3.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M8 3.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="6.5" cy="8.5" r="0.75" fill="currentColor" />
        <circle cx="9.5" cy="8.5" r="0.75" fill="currentColor" />
      </svg>
      <span>Agent</span>
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
  initialUrl,
  browserRuntimeHostEnabled
}: WorkspacePanelProps) {
  const resolvedTheme = useResolvedTheme()
  const autoCenterFocusedPanel = useUiStore((state) => state.autoCenterFocusedPanel)
  const updatePanelLayout = useWorkspacesStore((state) => state.updatePanelLayout)
  const setFocusedPanel = useWorkspacesStore((state) => state.setFocusedPanel)
  const isDirty = useWorkspacesStore((state) => Boolean(state.dirtyPanelIds[panelId]))
  const markPanelVisible = usePanelRuntimeStore((state) => state.markPanelVisible)
  const browserAutomationAttached = usePanelRuntimeStore(
    (state) => Boolean(state.panelRuntimeById[panelId]?.browserAutomationAttached)
  )
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
  const [fileChromeState, setFileChromeState] = useState<FilePanelChromeState>({
    relativePath: null,
    isExplorerCollapsed: false,
    canSave: false,
    canReload: false,
    isSaving: false,
    onSave: null,
    onReload: null,
    onToggleExplorer: null
  })

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
  const showBrowserAutomationChrome = panelType === 'browser' && browserAutomationAttached

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
        'relative flex flex-col rounded-xl border',
        isFocused ? 'border-border/80 shadow-xl shadow-black/25' : 'border-border/50 shadow-md shadow-black/15',
        showBrowserAutomationChrome && 'shadow-[0_0_0_1px_rgba(115,115,115,0.45)]',
        'bg-bg',
        isResizing && 'select-none'
      )}
      style={{
        width: size.width,
        height: size.height,
        ...style
      }}
    >
      {showBrowserAutomationChrome ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[3px] rounded-md border border-text-muted/20"
        />
      ) : null}

      <div className="flex h-8 items-center justify-between gap-2 rounded-t-xl border-b border-border/50 bg-bg-raised/80 px-2.5 flex-shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <PanelGlyph panelType={panelType} providerId={providerId} className="text-text-secondary" />
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-medium text-text-primary">{panelLabel}</span>
            {isDirty ? (
              <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                Dirty
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showBrowserAutomationChrome ? <BrowserAutomationBadge /> : null}
          {panelType === 'file' ? (
            <>
              <PanelIconButton
                label={fileChromeState.isExplorerCollapsed ? 'Show file tree' : 'Hide file tree'}
                onClick={() => fileChromeState.onToggleExplorer?.()}
              >
                {fileChromeState.isExplorerCollapsed ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M5.5 3L2.5 5.5L5.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                    <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M10.5 3L13.5 5.5L10.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </PanelIconButton>
              <PanelIconButton
                label="Reload file"
                onClick={() => fileChromeState.onReload?.()}
                disabled={!fileChromeState.canReload}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M12.5 5.5A5 5 0 1 0 13 9.5M12.5 5.5V2.5M12.5 5.5H9.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </PanelIconButton>
              <PanelIconButton
                label={fileChromeState.isSaving ? 'Saving file' : 'Save file'}
                onClick={() => fileChromeState.onSave?.()}
                disabled={!fileChromeState.canSave}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3.5 2.5H10.5L12.5 4.5V13.5H3.5V2.5Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <path d="M5.5 2.5V6H10.5V2.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M6 10.5H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </PanelIconButton>
            </>
          ) : null}
          <button onClick={onClose} className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary">
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <PanelFocusHitArea
          panelId={panelId}
          revealPanel={revealPanel}
          setFocusedPanel={setFocusedPanel}
          autoCenterFocusedPanel={autoCenterFocusedPanel}
        />
        <PanelContentHost panelId={panelId}>
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
              hostEnabled={browserRuntimeHostEnabled}
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
              onChromeStateChange={setFileChromeState}
            />
          ) : (
            <PanelPlaceholder type={panelType} />
          )}
        </PanelContentHost>
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
