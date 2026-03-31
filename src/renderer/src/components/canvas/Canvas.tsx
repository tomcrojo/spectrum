import { useEffect, useLayoutEffect, useCallback, useMemo, useRef, useState } from 'react'
import {
  CANVAS_ZOOM_STEPS,
  useUiStore
} from '@renderer/stores/ui.store'
import { useWorkspacesStore, type ActiveWorkspacePanel } from '@renderer/stores/workspaces.store'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useProjectsStore } from '@renderer/stores/projects.store'
import {
  incrementDevMountCount,
  recordDevPerformanceTiming,
  setDevPerformanceCounter
} from '@renderer/lib/dev-performance'
import { WorkspacePanel } from './WorkspacePanel'
import { NewCanvasItemMenu } from './NewCanvasItemMenu'
import { CanvasToolbar } from './CanvasToolbar'
import { EdgeButton } from './EdgeButton'
import { cn } from '@renderer/lib/cn'
import { nanoid } from 'nanoid'
import type { PanelType, PanelHydrationState, Workspace } from '@shared/workspace.types'

const VIRTUAL_PADDING = 5000
const STRUCTURED_SCROLL_ALLOWANCE = 288
const GRID_SIZE = 24
const FIT_CONTENT_PADDING = 96
const MIN_GRID_OPACITY = 0.18
const FIT_ZOOM_TOLERANCE = 0.02
const FIT_SCROLL_TOLERANCE = 24
const FIT_MOVE_DURATION_MS = 180
const FIT_ZOOM_DURATION_MS = 140
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function clampScroll(value: number, max: number): number {
  return Math.min(Math.max(0, value), max)
}

function getGridOpacity(zoom: number): number {
  if (zoom >= 1) {
    return 1
  }

  const minZoom = CANVAS_ZOOM_STEPS[0]
  const normalized = (zoom - minZoom) / (1 - minZoom)
  return Math.max(MIN_GRID_OPACITY, Math.min(1, MIN_GRID_OPACITY + normalized * (1 - MIN_GRID_OPACITY)))
}

function getPanelDisplayWidth(panel: Pick<ActiveWorkspacePanel, 'panelType' | 'width'>): number {
  if (typeof panel.width === 'number' && Number.isFinite(panel.width)) {
    return panel.width
  }

  return panel.panelType === 't3code' || panel.panelType === 'chat' ? 400 : 700
}

function buildActivePanel(workspace: Workspace, cwd: string): ActiveWorkspacePanel {
  const panel = workspace.layoutState.panels[0] ?? {
    id: nanoid(),
    type: 'terminal' as const,
    title: 'Terminal'
  }

  return {
    panelId: panel.id,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    cwd,
    panelType: panel.type,
    panelTitle: panel.title,
    providerId: panel.providerId,
    filePath: panel.filePath,
    cursorLine: panel.cursorLine,
    cursorColumn: panel.cursorColumn,
    t3ProjectId: panel.t3ProjectId,
    t3ThreadId: panel.t3ThreadId
  }
}

export function Canvas() {
  const {
    activeProjectId,
    autoCenterFocusedPanel,
    canvasInteractionMode,
    runtimePowerMode,
    canvasZoom,
    setCanvasZoom,
    zoomIn,
    zoomOut,
    resetZoom
  } = useUiStore()
  const {
    workspaces,
    activePanels,
    focusedPanelId,
    loadWorkspaces,
    createWorkspace,
    setActivePanels,
    addActivePanel,
    insertPanelAfter,
    prependPanelToWorkspace,
    requestClosePanel,
    restorePanelsFromWorkspaces
  } = useWorkspacesStore()
  const activeWorkspaceId = usePanelRuntimeStore((state) => state.activeWorkspaceId)
  const panelRuntimeById = usePanelRuntimeStore((state) => state.panelRuntimeById)
  const setActiveWorkspaceId = usePanelRuntimeStore((state) => state.setActiveWorkspaceId)
  const setPanelHydrationState = usePanelRuntimeStore((state) => state.setPanelHydrationState)
  const { projects } = useProjectsStore()
  const didAutoOpenRef = useRef<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasWheelCleanupRef = useRef<(() => void) | null>(null)
  const contentMeasureRef = useRef<HTMLDivElement>(null)
  const previousZoomRef = useRef(canvasZoom)
  const fitAnimationFrameRef = useRef<number | null>(null)
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 })
  const [canvasInsets, setCanvasInsets] = useState({
    top: 24,
    right: 24,
    bottom: 24,
    left: 24
  })

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null
  const projectWorkspaces = activeProjectId
    ? workspaces.filter(
        (workspace) => workspace.projectId === activeProjectId && !workspace.archived
      )
    : []
  const panelsByWorkspace = useMemo(() => {
    const panelsById = new Map<string, ActiveWorkspacePanel[]>()

    for (const panel of activePanels) {
      const existing = panelsById.get(panel.workspaceId)
      if (existing) {
        existing.push(panel)
      } else {
        panelsById.set(panel.workspaceId, [panel])
      }
    }

    return projectWorkspaces
      .map((workspace) => ({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        panels: panelsById.get(workspace.id) ?? []
      }))
      .filter((workspace) => workspace.panels.length > 0)
  }, [activePanels, projectWorkspaces])

  const focusedPanel = useMemo(
    () => activePanels.find((panel) => panel.panelId === focusedPanelId) ?? null,
    [activePanels, focusedPanelId]
  )
  const isFreeCanvas = canvasInteractionMode === 'free'
  const paddedInsets = useMemo(
    () => ({
      top: canvasInsets.top + (isFreeCanvas ? VIRTUAL_PADDING : STRUCTURED_SCROLL_ALLOWANCE),
      right: canvasInsets.right + (isFreeCanvas ? VIRTUAL_PADDING : 0),
      bottom: canvasInsets.bottom + (isFreeCanvas ? VIRTUAL_PADDING : 0),
      left: canvasInsets.left + (isFreeCanvas ? VIRTUAL_PADDING : STRUCTURED_SCROLL_ALLOWANCE)
    }),
    [canvasInsets, isFreeCanvas]
  )
  const gridOpacity = useMemo(() => getGridOpacity(canvasZoom), [canvasZoom])

  useEffect(() => {
    incrementDevMountCount('Canvas')
  }, [])

  // Load workspaces when project changes and restore saved panel state
  useEffect(() => {
    if (!activeProjectId) {
      setActivePanels([])
      setActiveWorkspaceId(null)
      didAutoOpenRef.current = null
      return
    }

    let cancelled = false
    const startedAt = performance.now()

    loadWorkspaces(activeProjectId, false).then(() => {
      if (cancelled) return

      const { workspaces: loadedWorkspaces } = useWorkspacesStore.getState()
      const projectWs = loadedWorkspaces.filter(
        (workspace) => workspace.projectId === activeProjectId && !workspace.archived
      )

      const hasSavedPanels = projectWs.some((w) => w.layoutState.panels.length > 0)
      const initialWorkspaceId = projectWs[0]?.id ?? null

      if (hasSavedPanels && activeProject) {
        didAutoOpenRef.current = activeProjectId
        restorePanelsFromWorkspaces(projectWs, activeProject.repoPath)
        setActiveWorkspaceId(initialWorkspaceId)
      } else if (projectWs.length > 0 && activeProject) {
        didAutoOpenRef.current = activeProjectId
        setActivePanels([buildActivePanel(projectWs[0], activeProject.repoPath)])
        setActiveWorkspaceId(projectWs[0].id)
      } else {
        setActivePanels([])
        setActiveWorkspaceId(null)
        didAutoOpenRef.current = null
      }

      recordDevPerformanceTiming('project-open', performance.now() - startedAt)
    })

    return () => {
      cancelled = true
    }
  }, [activeProjectId, activeProject, loadWorkspaces, restorePanelsFromWorkspaces, setActivePanels, setActiveWorkspaceId])

  useEffect(() => {
    if (!activeWorkspaceId && projectWorkspaces[0]) {
      setActiveWorkspaceId(projectWorkspaces[0].id)
    }
  }, [activeWorkspaceId, projectWorkspaces, setActiveWorkspaceId])

  useEffect(() => {
    let liveBrowserCount = 0
    let liveT3Count = 0

    for (const panel of activePanels) {
      let nextHydrationState: PanelHydrationState = panelRuntimeById[panel.panelId]?.hydrationState ?? 'cold'

      if (panel.panelType === 'browser') {
        nextHydrationState = panel.workspaceId === activeWorkspaceId ? 'live' : 'cold'
      } else if (panel.panelType === 't3code') {
        if (runtimePowerMode === 'high') {
          nextHydrationState = 'live'
        } else if (panel.workspaceId === activeWorkspaceId) {
          if (focusedPanelId === panel.panelId || runtimePowerMode === 'mid') {
            nextHydrationState = 'live'
          } else if (nextHydrationState === 'live') {
            nextHydrationState = 'live'
          } else {
            const workspacePanels = activePanels.filter((entry) => entry.workspaceId === panel.workspaceId)
            nextHydrationState =
              panelRuntimeById[panel.panelId]?.lastHydratedAt == null && workspacePanels[0]?.panelId === panel.panelId
                ? 'live'
                : 'cold'
          }
        } else {
          nextHydrationState = 'cold'
        }
      } else {
        nextHydrationState = 'live'
      }

      setPanelHydrationState(panel.panelId, nextHydrationState)
      if (panel.panelType === 'browser' && nextHydrationState === 'live') {
        liveBrowserCount += 1
      }
      if (panel.panelType === 't3code' && nextHydrationState === 'live') {
        liveT3Count += 1
      }
    }

    setDevPerformanceCounter('live-browser-webviews', liveBrowserCount)
    setDevPerformanceCounter('live-t3-iframes', liveT3Count)
  }, [
    activePanels,
    activeWorkspaceId,
    focusedPanelId,
    panelRuntimeById,
    runtimePowerMode,
    setPanelHydrationState
  ])

  useEffect(() => {
    setDevPerformanceCounter('workspace-shell-count', projectWorkspaces.length)
  }, [projectWorkspaces.length])

  useEffect(() => {
    setDevPerformanceCounter(
      'watched-t3-thread-count',
      activePanels.filter((panel) => panel.panelType === 't3code' && Boolean(panel.t3ThreadId)).length
    )
  }, [activePanels])

  useEffect(() => {
    if (!activeProjectId) {
      return
    }

    if (!isFreeCanvas) {
      previousZoomRef.current = 1
      setCanvasZoom(1)
      return
    }

    previousZoomRef.current = 1
    setCanvasZoom(1)
  }, [activeProjectId, isFreeCanvas, setCanvasZoom])

  useLayoutEffect(() => {
    const content = contentMeasureRef.current
    if (!content) return

    const updateContentSize = () => {
      const nextWidth = content.offsetWidth
      const nextHeight = content.offsetHeight

      setContentSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      )
    }

    updateContentSize()

    const resizeObserver = new ResizeObserver(() => {
      updateContentSize()
    })

    resizeObserver.observe(content)

    return () => {
      resizeObserver.disconnect()
    }
  }, [panelsByWorkspace, activePanels.length])

  useLayoutEffect(() => {
    if (!autoCenterFocusedPanel) {
      setCanvasInsets((current) =>
        current.top === 24 &&
        current.right === 24 &&
        current.bottom === 24 &&
        current.left === 24
          ? current
          : { top: 24, right: 24, bottom: 24, left: 24 }
      )
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const focusedPanel = focusedPanelId
      ? canvas.querySelector<HTMLElement>(`[data-panel-id="${focusedPanelId}"]`)
      : null

    if (!focusedPanel) {
      setCanvasInsets((current) =>
        current.top === 24 &&
        current.right === 24 &&
        current.bottom === 24 &&
        current.left === 24
          ? current
          : { top: 24, right: 24, bottom: 24, left: 24 }
      )
      return
    }

    const updateInsets = () => {
      const centeredHorizontalInset = Math.max(24, (canvas.clientWidth - focusedPanel.offsetWidth) / 2)
      const nextInsets = {
        top: Math.max(24, (canvas.clientHeight - focusedPanel.offsetHeight) / 2),
        right: centeredHorizontalInset,
        bottom: Math.max(24, (canvas.clientHeight - focusedPanel.offsetHeight) / 2),
        left: isFreeCanvas ? centeredHorizontalInset : 24
      }

      setCanvasInsets((current) =>
        current.top === nextInsets.top &&
        current.right === nextInsets.right &&
        current.bottom === nextInsets.bottom &&
        current.left === nextInsets.left
          ? current
          : nextInsets
      )
    }

    updateInsets()

    const resizeObserver = new ResizeObserver(() => {
      updateInsets()
    })

    resizeObserver.observe(canvas)
    resizeObserver.observe(focusedPanel)

    return () => {
      resizeObserver.disconnect()
    }
  }, [autoCenterFocusedPanel, focusedPanelId, activePanels, isFreeCanvas])

  useLayoutEffect(() => {
    if (!isFreeCanvas) {
      previousZoomRef.current = 1
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    if (previousZoomRef.current === canvasZoom) return

    const previousZoom = previousZoomRef.current
    const worldCenterX =
      (canvas.scrollLeft - paddedInsets.left + canvas.clientWidth / 2) / previousZoom
    const worldCenterY =
      (canvas.scrollTop - paddedInsets.top + canvas.clientHeight / 2) / previousZoom
    const targetScrollLeft =
      paddedInsets.left + worldCenterX * canvasZoom - canvas.clientWidth / 2
    const targetScrollTop =
      paddedInsets.top + worldCenterY * canvasZoom - canvas.clientHeight / 2

    previousZoomRef.current = canvasZoom
    canvas.scrollTo({
      left: clampScroll(targetScrollLeft, canvas.scrollWidth - canvas.clientWidth),
      top: clampScroll(targetScrollTop, canvas.scrollHeight - canvas.clientHeight)
    })
  }, [canvasZoom, isFreeCanvas, paddedInsets.left, paddedInsets.top])

  useEffect(() => {
    return () => {
      if (fitAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(fitAnimationFrameRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.scrollTo({
      left: isFreeCanvas ? VIRTUAL_PADDING : STRUCTURED_SCROLL_ALLOWANCE,
      top: isFreeCanvas ? VIRTUAL_PADDING : STRUCTURED_SCROLL_ALLOWANCE
    })
  }, [activeProjectId, isFreeCanvas])

  const setCanvasNode = useCallback((node: HTMLDivElement | null) => {
    if (canvasWheelCleanupRef.current) {
      canvasWheelCleanupRef.current()
      canvasWheelCleanupRef.current = null
    }

    canvasRef.current = node

    if (!node) {
      return
    }

    if (!isFreeCanvas) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return
      }

      if (!(event.target instanceof Node) || !node.contains(event.target)) {
        return
      }

      event.preventDefault()

      if (event.deltaY < 0) {
        zoomIn()
      } else if (event.deltaY > 0) {
        zoomOut()
      }
    }

    window.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    canvasWheelCleanupRef.current = () => {
      window.removeEventListener('wheel', handleWheel, true)
    }
  }, [isFreeCanvas, zoomIn, zoomOut])

  useEffect(() => {
    if (!isFreeCanvas) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || isEditableTarget(event.target)) {
        return
      }

      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        zoomIn()
        return
      }

      if (event.key === '-') {
        event.preventDefault()
        zoomOut()
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        resetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFreeCanvas, resetZoom, zoomIn, zoomOut])

  const handleNewWorkspace = useCallback(async () => {
    if (!activeProjectId || !activeProject) return
    didAutoOpenRef.current = activeProjectId
    const nextWorkspaceNumber = projectWorkspaces.length + 1
    const ws = await createWorkspace({
      projectId: activeProjectId,
      name: `Workspace ${nextWorkspaceNumber}`,
      layoutState: {
        panels: [{ id: nanoid(), type: 't3code', title: 'T3Code' }],
        sizes: [100]
      }
    })
    addActivePanel(buildActivePanel(ws, activeProject.repoPath))
  }, [activeProjectId, activeProject, projectWorkspaces.length, createWorkspace])

  const handleAddPanel = useCallback(async (panelType: PanelType) => {
    if (!activeProjectId || !activeProject) return

    // Find the focused panel to determine target workspace and insertion position
    const focusedPanel = focusedPanelId
      ? activePanels.find((p) => p.panelId === focusedPanelId)
      : null

    let targetWorkspace = focusedPanel
      ? projectWorkspaces.find((ws) => ws.id === focusedPanel.workspaceId)
      : projectWorkspaces.find(
          (workspace) => workspace.id === activePanels.at(-1)?.workspaceId
        ) ?? projectWorkspaces[0]

    if (!targetWorkspace) {
      didAutoOpenRef.current = activeProjectId
      const nextWorkspaceNumber = projectWorkspaces.length + 1
      targetWorkspace = await createWorkspace({
        projectId: activeProjectId,
        name: `Workspace ${nextWorkspaceNumber}`,
        layoutState: {
          panels: [{ id: nanoid(), type: 't3code', title: 'T3Code' }],
          sizes: [100]
        }
      })
      addActivePanel(buildActivePanel(targetWorkspace, activeProject.repoPath))
    }

    const panelTitle =
      panelType === 't3code'
        ? 'T3Code'
        : panelType === 'browser'
          ? 'Browser'
          : panelType === 'chat'
            ? 'Chat'
            : panelType === 'file'
              ? 'Files'
              : 'Terminal'

    const newPanel: ActiveWorkspacePanel = {
      panelId: nanoid(),
      workspaceId: targetWorkspace.id,
      workspaceName: targetWorkspace.name,
      cwd: activeProject.repoPath,
      panelType,
      panelTitle
    }

    // Insert right after the focused panel, or append if no focus
    if (focusedPanel && focusedPanel.workspaceId === targetWorkspace.id) {
      insertPanelAfter(newPanel, focusedPanel.panelId)
    } else {
      addActivePanel(newPanel)
    }
  }, [activeProjectId, activeProject, activePanels, focusedPanelId, projectWorkspaces, createWorkspace, addActivePanel, insertPanelAfter])

  const handlePrependPanelToWorkspace = useCallback((panelType: PanelType, workspaceId: string) => {
    if (!activeProject) return

    const workspace = projectWorkspaces.find((ws) => ws.id === workspaceId)
    if (!workspace) return

    const panelTitle =
      panelType === 't3code'
        ? 'T3Code'
        : panelType === 'browser'
          ? 'Browser'
          : panelType === 'chat'
            ? 'Chat'
            : panelType === 'file'
              ? 'Files'
              : 'Terminal'

    const newPanel: ActiveWorkspacePanel = {
      panelId: nanoid(),
      workspaceId,
      workspaceName: workspace.name,
      cwd: activeProject.repoPath,
      panelType,
      panelTitle
    }

    prependPanelToWorkspace(newPanel)
  }, [activeProject, projectWorkspaces, prependPanelToWorkspace])

  const handleAppendPanelToWorkspace = useCallback((panelType: PanelType, workspaceId: string) => {
    if (!activeProject) return

    const workspace = projectWorkspaces.find((ws) => ws.id === workspaceId)
    if (!workspace) return

    const panelTitle =
      panelType === 't3code'
        ? 'T3Code'
        : panelType === 'browser'
          ? 'Browser'
          : panelType === 'chat'
            ? 'Chat'
            : panelType === 'file'
              ? 'Files'
              : 'Terminal'

    const newPanel: ActiveWorkspacePanel = {
      panelId: nanoid(),
      workspaceId,
      workspaceName: workspace.name,
      cwd: activeProject.repoPath,
      panelType,
      panelTitle
    }

    const workspacePanels = activePanels.filter((p) => p.workspaceId === workspaceId)
    const lastPanel = workspacePanels.at(-1)
    if (lastPanel) {
      insertPanelAfter(newPanel, lastPanel.panelId)
    } else {
      addActivePanel(newPanel)
    }
  }, [activeProject, projectWorkspaces, activePanels, insertPanelAfter, addActivePanel])

  const handleClosePanel = useCallback((panelId: string) => {
    void requestClosePanel(panelId)
  }, [requestClosePanel])

  const handleCanvasPointerDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isFreeCanvas) return
    if (event.button !== 0) return
    if (!(event.target instanceof HTMLElement)) return
    if (
      event.target.closest('[data-panel-root="true"]') ||
      event.target.closest('button, input, textarea, a, [role="button"]')
    ) {
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const startX = event.clientX
    const startY = event.clientY
    const startScrollLeft = canvas.scrollLeft
    const startScrollTop = canvas.scrollTop

    setIsPanning(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      canvas.scrollLeft = startScrollLeft - (moveEvent.clientX - startX)
      canvas.scrollTop = startScrollTop - (moveEvent.clientY - startY)
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [isFreeCanvas])

  const panelOptions = useMemo(
    () => [
      {
        label: 'T3Code',
        description: 'Open a T3Code panel in the current workspace.',
        onSelect: () => {
          setShowCreateMenu(false)
          void handleAddPanel('t3code')
        }
      },
      {
        label: 'Terminal',
        description: 'Open a terminal panel in the current workspace.',
        onSelect: () => {
          setShowCreateMenu(false)
          void handleAddPanel('terminal')
        }
      },
      {
        label: 'Browser',
        description: 'Open a browser panel in the current workspace.',
        onSelect: () => {
          setShowCreateMenu(false)
          void handleAddPanel('browser')
        }
      },
      {
        label: 'File Editor',
        description: 'Browse project files and edit code inside the workspace.',
        onSelect: () => {
          setShowCreateMenu(false)
          void handleAddPanel('file')
        }
      }
    ],
    [handleAddPanel]
  )

  const workspaceOption = useMemo(
    () => ({
      label: 'Workspace',
      description: 'Create a new vertical workspace that starts with a T3Code panel.',
      onSelect: () => {
        setShowCreateMenu(false)
        void handleNewWorkspace()
      }
    }),
    [handleNewWorkspace]
  )

  const buildEdgePanelOptions = useCallback(
    (workspaceId: string) => [
      {
        label: 'T3Code',
        description: 'Open a T3Code panel in this workspace.',
        onSelect: () => void handleAppendPanelToWorkspace('t3code', workspaceId)
      },
      {
        label: 'Terminal',
        description: 'Open a terminal panel in this workspace.',
        onSelect: () => void handleAppendPanelToWorkspace('terminal', workspaceId)
      },
      {
        label: 'Browser',
        description: 'Open a browser panel in this workspace.',
        onSelect: () => void handleAppendPanelToWorkspace('browser', workspaceId)
      },
      {
        label: 'File Editor',
        description: 'Browse project files and edit code inside the workspace.',
        onSelect: () => void handleAppendPanelToWorkspace('file', workspaceId)
      }
    ],
    [handleAppendPanelToWorkspace]
  )

  const handleFitToContent = useCallback(() => {
    if (!isFreeCanvas) {
      return
    }

    const canvas = canvasRef.current
    const content = contentMeasureRef.current
    if (!canvas || !content) return
    if (fitAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(fitAnimationFrameRef.current)
      fitAnimationFrameRef.current = null
    }

    const panelElements = Array.from(
      content.querySelectorAll<HTMLElement>('[data-panel-root="true"]')
    )
    if (panelElements.length === 0) {
      return
    }

    const contentRect = content.getBoundingClientRect()
    const bounds = panelElements.reduce(
      (acc, panel) => {
        const panelRect = panel.getBoundingClientRect()
        const left = (panelRect.left - contentRect.left) / canvasZoom
        const top = (panelRect.top - contentRect.top) / canvasZoom
        const right = left + panelRect.width / canvasZoom
        const bottom = top + panelRect.height / canvasZoom

        return {
          left: Math.min(acc.left, left),
          top: Math.min(acc.top, top),
          right: Math.max(acc.right, right),
          bottom: Math.max(acc.bottom, bottom)
        }
      },
      {
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY
      }
    )

    const contentWidth = Math.max(1, bounds.right - bounds.left)
    const contentHeight = Math.max(1, bounds.bottom - bounds.top)
    const nextZoom = Math.min(
      CANVAS_ZOOM_STEPS[CANVAS_ZOOM_STEPS.length - 1],
      Math.max(
        CANVAS_ZOOM_STEPS[0],
        Math.min(
          (canvas.clientWidth - FIT_CONTENT_PADDING * 2) / contentWidth,
          (canvas.clientHeight - FIT_CONTENT_PADDING * 2) / contentHeight
        )
      )
    )
    const fitScrollLeft =
      paddedInsets.left + ((bounds.left + bounds.right) / 2) * nextZoom - canvas.clientWidth / 2
    const fitScrollTop =
      paddedInsets.top + ((bounds.top + bounds.bottom) / 2) * nextZoom - canvas.clientHeight / 2
    const targetFitScrollLeft = clampScroll(
      fitScrollLeft,
      canvas.scrollWidth - canvas.clientWidth
    )
    const targetFitScrollTop = clampScroll(
      fitScrollTop,
      canvas.scrollHeight - canvas.clientHeight
    )

    const getScrollForWorldPoint = (worldX: number, worldY: number, zoom: number) => ({
      left: clampScroll(
        paddedInsets.left + worldX * zoom - canvas.clientWidth / 2,
        canvas.scrollWidth - canvas.clientWidth
      ),
      top: clampScroll(
        paddedInsets.top + worldY * zoom - canvas.clientHeight / 2,
        canvas.scrollHeight - canvas.clientHeight
      )
    })

    const animateMoveThenZoom = (
      targetZoom: number,
      targetWorldCenterX: number,
      targetWorldCenterY: number
    ) => {
      const startZoom = useUiStore.getState().canvasZoom
      const startScrollLeft = canvas.scrollLeft
      const startScrollTop = canvas.scrollTop
      const moveTarget = getScrollForWorldPoint(targetWorldCenterX, targetWorldCenterY, startZoom)

      const animate = (timestamp: number) => {
        const elapsed = timestamp - startTimestamp

        if (elapsed <= FIT_MOVE_DURATION_MS) {
          const progress = Math.min(1, elapsed / FIT_MOVE_DURATION_MS)
          canvas.scrollLeft = startScrollLeft + (moveTarget.left - startScrollLeft) * progress
          canvas.scrollTop = startScrollTop + (moveTarget.top - startScrollTop) * progress
          fitAnimationFrameRef.current = window.requestAnimationFrame(animate)
          return
        }

        const zoomElapsed = elapsed - FIT_MOVE_DURATION_MS
        const zoomProgress = Math.min(1, zoomElapsed / FIT_ZOOM_DURATION_MS)
        const nextZoom = startZoom + (targetZoom - startZoom) * zoomProgress
        const nextScroll = getScrollForWorldPoint(targetWorldCenterX, targetWorldCenterY, nextZoom)

        useUiStore.getState().setCanvasZoom(nextZoom)
        canvas.scrollLeft = nextScroll.left
        canvas.scrollTop = nextScroll.top

        if (zoomProgress < 1) {
          fitAnimationFrameRef.current = window.requestAnimationFrame(animate)
          return
        }

        setCanvasZoom(targetZoom)
        canvas.scrollLeft = getScrollForWorldPoint(targetWorldCenterX, targetWorldCenterY, targetZoom).left
        canvas.scrollTop = getScrollForWorldPoint(targetWorldCenterX, targetWorldCenterY, targetZoom).top
        fitAnimationFrameRef.current = null
      }

      const startTimestamp = performance.now()
      fitAnimationFrameRef.current = window.requestAnimationFrame(animate)
    }

    const isAlreadyShowingEverything =
      Math.abs(canvasZoom - nextZoom) <= FIT_ZOOM_TOLERANCE &&
      Math.abs(canvas.scrollLeft - targetFitScrollLeft) <= FIT_SCROLL_TOLERANCE &&
      Math.abs(canvas.scrollTop - targetFitScrollTop) <= FIT_SCROLL_TOLERANCE

    if (isAlreadyShowingEverything && focusedPanelId) {
      const focusedPanelElement = content.querySelector<HTMLElement>(
        `[data-panel-id="${focusedPanelId}"]`
      )

      if (focusedPanelElement) {
        const focusedPanelRect = focusedPanelElement.getBoundingClientRect()
        const left = (focusedPanelRect.left - contentRect.left) / canvasZoom
        const top = (focusedPanelRect.top - contentRect.top) / canvasZoom
        const width = focusedPanelRect.width / canvasZoom
        const height = focusedPanelRect.height / canvasZoom
        const detailZoom = 1
        const targetWorldCenterX = left + width / 2
        const targetWorldCenterY = top + height / 2

        animateMoveThenZoom(detailZoom, targetWorldCenterX, targetWorldCenterY)

        return
      }
    }

    const targetWorldCenterX = (bounds.left + bounds.right) / 2
    const targetWorldCenterY = (bounds.top + bounds.bottom) / 2

    animateMoveThenZoom(nextZoom, targetWorldCenterX, targetWorldCenterY)
  }, [canvasZoom, focusedPanelId, isFreeCanvas, paddedInsets.left, paddedInsets.top, setCanvasZoom])

  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center canvas-grid">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-20">🐛</div>
          <p className="text-sm text-text-muted">
            Select a project or create a new one
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1">
      <div className="absolute left-3 top-3 z-20 w-fit">
        <button
          onClick={() => setShowCreateMenu((open) => !open)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-raised border border-border text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 2V10M2 6H10"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
          New
        </button>
        <NewCanvasItemMenu
          open={showCreateMenu}
          onClose={() => setShowCreateMenu(false)}
          panelOptions={panelOptions}
          workspaceOption={workspaceOption}
        />
      </div>
      <div
        ref={setCanvasNode}
        data-canvas-scroll-root="true"
        onMouseDown={handleCanvasPointerDown}
        className={cn(
          'canvas-grid absolute inset-0 overflow-auto',
          isFreeCanvas
            ? isPanning
              ? 'cursor-grabbing select-none'
              : 'cursor-grab'
            : 'cursor-default'
        )}
        style={{
          backgroundImage: `radial-gradient(circle, color-mix(in srgb, var(--color-border) ${Math.round(gridOpacity * 100)}%, transparent) 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE * (isFreeCanvas ? canvasZoom : 1)}px ${GRID_SIZE * (isFreeCanvas ? canvasZoom : 1)}px`
        }}
      >
        <div
          style={{
            paddingTop: paddedInsets.top,
            paddingRight: paddedInsets.right,
            paddingBottom: paddedInsets.bottom,
            paddingLeft: paddedInsets.left
          }}
        >
          <div
            className="relative"
            style={{
              width: contentSize.width * canvasZoom,
              height: contentSize.height * canvasZoom
            }}
          >
            <div
              ref={contentMeasureRef}
              className="absolute left-0 top-0 flex w-max flex-col gap-6"
              style={{
                transform: `scale(${canvasZoom})`,
                transformOrigin: 'top left'
              }}
            >
              {panelsByWorkspace.map((workspace, wsIndex) => (
                <div key={workspace.workspaceId} className="flex items-start gap-6">
                  {workspace.panels.map((panel, panelIndex) => {
                    const isFocused = panel.panelId === focusedPanel?.panelId
                    const showRightButton = isFocused && panelIndex === workspace.panels.length - 1
                    const showTopButton = isFocused && wsIndex === 0
                    const showBottomButton =
                      isFocused && wsIndex === panelsByWorkspace.length - 1
                    const panelDisplayWidth = getPanelDisplayWidth(panel)

                    return (
                      <div key={panel.panelId} className="flex items-stretch gap-3">
                        <div className="relative">
                          {showTopButton && (
                            <div className="absolute bottom-full left-0 mb-3">
                              <EdgeButton
                                direction="top"
                                label="New Workspace"
                                onClick={handleNewWorkspace}
                                width={panelDisplayWidth}
                              />
                            </div>
                          )}

                          <WorkspacePanel
                            workspaceId={panel.workspaceId}
                            workspaceName={panel.workspaceName}
                            projectId={activeProjectId}
                            projectName={activeProject?.name ?? 'Project'}
                            cwd={panel.cwd}
                            panelType={panel.panelType}
                            panelTitle={panel.panelTitle}
                            filePath={panel.filePath}
                            cursorLine={panel.cursorLine}
                            cursorColumn={panel.cursorColumn}
                            panelId={panel.panelId}
                            providerId={panel.providerId}
                            t3ProjectId={panel.t3ProjectId}
                            t3ThreadId={panel.t3ThreadId}
                            hydrationState={panelRuntimeById[panel.panelId]?.hydrationState ?? 'cold'}
                            isFocused={panel.panelId === focusedPanelId}
                            isActiveWorkspace={panel.workspaceId === activeWorkspaceId}
                            onClose={() => handleClosePanel(panel.panelId)}
                            initialWidth={panel.width}
                            initialHeight={panel.height}
                            initialUrl={panel.url}
                          />

                          {showBottomButton && (
                            <div className="absolute left-0 top-full mt-3">
                              <EdgeButton
                                direction="bottom"
                                label="New Workspace"
                                onClick={handleNewWorkspace}
                                width={panelDisplayWidth}
                              />
                            </div>
                          )}
                        </div>

                        {showRightButton && (
                          <EdgeButton
                            direction="right"
                            label="New"
                            menuOptions={buildEdgePanelOptions(workspace.workspaceId)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {activePanels.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="mb-3 text-xs text-text-muted opacity-50">No open workspaces</p>
              <button
                onClick={() => setShowCreateMenu(true)}
                className="pointer-events-auto text-xs text-accent hover:text-accent-hover transition-colors"
              >
                Open the create menu
              </button>
            </div>
          </div>
        )}
      </div>

      {isFreeCanvas && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20">
          <CanvasToolbar
            canvasZoom={canvasZoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetZoom={resetZoom}
            onFitToContent={handleFitToContent}
          />
        </div>
      )}
    </div>
  )
}
