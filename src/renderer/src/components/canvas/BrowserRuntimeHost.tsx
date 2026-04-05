import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useReducer,
  useState
} from 'react'
import { browserApi } from '@renderer/lib/ipc'
import {
  consumeBrowserRuntimeCommands,
  formatBrowserLoadFailure,
  getBrowserSlots,
  isFatalBrowserLoadFailure,
  subscribeBrowserRuntimeCommands,
  subscribeBrowserSlots,
  type BrowserRuntimeMode
} from '@renderer/lib/browser-runtime'
import { getVisibleBrowserWorkspaceIds } from '@renderer/lib/browser-visibility'
import { useUiStore } from '@renderer/stores/ui.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useBrowserUiStore } from '@renderer/stores/browser-ui.store'

const MAX_LIVE_BROWSER_RUNTIMES = 20
const HEADLESS_BROWSER_WIDTH = 1280
const HEADLESS_BROWSER_HEIGHT = 800
const OFFSCREEN_LEFT = -10000
const OFFSCREEN_TOP = -10000

interface ManagedRuntime {
  element: HTMLWebViewElement | HTMLIFrameElement
  cleanup: () => void
}

interface BrowserRuntimeHostProps {
  hostEnabled: boolean
}

function getBackgroundVisibleBudget(runtimePowerMode: 'low' | 'mid' | 'high'): number {
  if (runtimePowerMode === 'low') {
    return 3
  }

  return 0
}

function getMaxLiveBrowserRuntimes(runtimePowerMode: 'low' | 'mid' | 'high'): number {
  return runtimePowerMode === 'high' ? Number.POSITIVE_INFINITY : MAX_LIVE_BROWSER_RUNTIMES
}

function sortByPriority(
  panelIds: string[],
  panelRuntimeById: ReturnType<typeof usePanelRuntimeStore.getState>['panelRuntimeById'],
  panelIndexById: Map<string, number>
): string[] {
  return [...panelIds].sort((left, right) => {
    const leftRuntime = panelRuntimeById[left]
    const rightRuntime = panelRuntimeById[right]
    const leftUser = leftRuntime?.browserLastUserInteractionAt ?? 0
    const rightUser = rightRuntime?.browserLastUserInteractionAt ?? 0

    if (leftUser !== rightUser) {
      return rightUser - leftUser
    }

    const leftAgent = leftRuntime?.browserLastAgentInteractionAt ?? 0
    const rightAgent = rightRuntime?.browserLastAgentInteractionAt ?? 0
    if (leftAgent !== rightAgent) {
      return rightAgent - leftAgent
    }

    return (panelIndexById.get(right) ?? -1) - (panelIndexById.get(left) ?? -1)
  })
}

function createWebviewElement(panelId: string, projectId: string, url: string): HTMLWebViewElement {
  const webview = document.createElement('webview') as HTMLWebViewElement
  webview.setAttribute('partition', `persist:project-${projectId}`)
  webview.setAttribute('allowpopups', 'true')
  webview.setAttribute('src', url)
  webview.dataset.panelId = panelId
  webview.style.background = 'var(--color-bg)'
  return webview
}

function createIframeElement(panelId: string, url: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.src = url
  iframe.title = `Browser runtime ${panelId}`
  iframe.tabIndex = -1
  iframe.dataset.panelId = panelId
  iframe.style.border = '0'
  iframe.style.background = 'var(--color-bg)'
  return iframe
}

function applyRuntimeBounds(
  element: HTMLWebViewElement | HTMLIFrameElement,
  mode: BrowserRuntimeMode,
  slotElement: HTMLElement | undefined
): void {
  const style = element.style
  style.position = 'fixed'
  style.margin = '0'
  style.padding = '0'
  style.border = '0'
  style.zIndex = '35'

  if (mode === 'visible' && slotElement) {
    const rect = slotElement.getBoundingClientRect()
    style.left = `${rect.left}px`
    style.top = `${rect.top}px`
    style.width = `${rect.width}px`
    style.height = `${rect.height}px`
    style.pointerEvents = slotElement.dataset.browserSlotResizing === 'true' ? 'none' : 'auto'
    style.opacity = slotElement.dataset.browserSlotResizing === 'true' ? '0.85' : '1'
    style.visibility = 'visible'
    return
  }

  if (mode === 'headless') {
    style.left = `${OFFSCREEN_LEFT}px`
    style.top = `${OFFSCREEN_TOP}px`
    style.width = `${HEADLESS_BROWSER_WIDTH}px`
    style.height = `${HEADLESS_BROWSER_HEIGHT}px`
    style.pointerEvents = 'none'
    style.opacity = '1'
    style.visibility = 'visible'
    return
  }

  style.left = `${OFFSCREEN_LEFT}px`
  style.top = `${OFFSCREEN_TOP}px`
  style.width = '1px'
  style.height = '1px'
  style.pointerEvents = 'none'
  style.opacity = '0'
  style.visibility = 'hidden'
}

export function BrowserRuntimeHost({ hostEnabled }: BrowserRuntimeHostProps) {
  const [commandNonce, bumpCommandNonce] = useReducer((value: number) => value + 1, 0)
  const [runtimeModeOverrides, setRuntimeModeOverrides] = useState<
    Record<string, BrowserRuntimeMode>
  >({})
  const hostLayerRef = useRef<HTMLDivElement | null>(null)
  const managedRuntimesRef = useRef(new Map<string, ManagedRuntime>())
  const previousDesiredModesRef = useRef(new Map<string, BrowserRuntimeMode>())
  const runtimeUrlByPanelIdRef = useRef(new Map<string, string>())
  const pendingPreviewCapturePanelIdsRef = useRef(new Set<string>())
  const slotEntries = useSyncExternalStore(subscribeBrowserSlots, getBrowserSlots, getBrowserSlots)
  const activeProjectId = useUiStore((state) => state.activeProjectId)
  const runtimePowerMode = useUiStore((state) => state.runtimePowerMode)
  const activePanels = useWorkspacesStore((state) => state.activePanels)
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const focusedBrowserPanelId = useWorkspacesStore((state) => state.focusedBrowserPanelId)
  const activeWorkspaceId = usePanelRuntimeStore((state) => state.activeWorkspaceId)
  const panelRuntimeById = usePanelRuntimeStore((state) => state.panelRuntimeById)

  useEffect(() => {
    if (!hostEnabled) {
      return
    }

    return subscribeBrowserRuntimeCommands(() => {
      bumpCommandNonce()
    })
  }, [hostEnabled])

  const browserPanels = useMemo(
    () => activePanels.filter((panel) => panel.panelType === 'browser'),
    [activePanels]
  )

  const runtimeModes = useMemo(() => {
    if (!hostEnabled) {
      return new Map<string, BrowserRuntimeMode>()
    }

    const projectBrowserPanels = browserPanels
    const panelIndexById = new Map(projectBrowserPanels.map((panel, index) => [panel.panelId, index]))
    const activeWorkspacePanelIds = projectBrowserPanels
      .filter((panel) => panel.workspaceId === activeWorkspaceId)
      .map((panel) => panel.panelId)
    const visibleWorkspaceIds =
      runtimePowerMode === 'low'
        ? null
        : getVisibleBrowserWorkspaceIds({
            browserPanels: projectBrowserPanels,
            workspaces: workspaces.filter(
              (workspace) =>
                workspace.projectId === activeProjectId && workspace.status === 'active'
            ),
            runtimePowerMode,
            activeWorkspaceId
          })

    const pinnedPanelIds = new Set<string>()
    for (const panel of projectBrowserPanels) {
      const runtime = panelRuntimeById[panel.panelId]
      if (
        panel.panelId === focusedBrowserPanelId ||
        runtime?.browserAutomationAttached ||
        panel.isTemporary
      ) {
        pinnedPanelIds.add(panel.panelId)
      }
    }

    for (const panel of projectBrowserPanels) {
      if (!panel.returnToPanelId) {
        continue
      }

      if (projectBrowserPanels.some((entry) => entry.panelId === panel.returnToPanelId)) {
        pinnedPanelIds.add(panel.returnToPanelId)
      }
    }

    const backgroundPanelIds = projectBrowserPanels
      .filter((panel) => panel.workspaceId !== activeWorkspaceId)
      .map((panel) => panel.panelId)
    const rankedBackgroundPanelIds = sortByPriority(
      backgroundPanelIds,
      panelRuntimeById,
      panelIndexById
    )
    const visibleBudget = getBackgroundVisibleBudget(runtimePowerMode)
    const visibleBackgroundPanelIds = new Set(
      visibleBudget === Number.POSITIVE_INFINITY
        ? rankedBackgroundPanelIds
        : rankedBackgroundPanelIds.slice(0, visibleBudget)
    )
    const maxLiveBrowserRuntimes = getMaxLiveBrowserRuntimes(runtimePowerMode)

    const livePanelIds = new Set(projectBrowserPanels.map((panel) => panel.panelId))
    const overflowCandidates = sortByPriority(
      projectBrowserPanels
        .map((panel) => panel.panelId)
        .filter((panelId) => !pinnedPanelIds.has(panelId) && !activeWorkspacePanelIds.includes(panelId)),
      panelRuntimeById,
      panelIndexById
    ).reverse()

    while (
      Number.isFinite(maxLiveBrowserRuntimes) &&
      livePanelIds.size > maxLiveBrowserRuntimes &&
      overflowCandidates.length > 0
    ) {
      const nextPanelId = overflowCandidates.shift()
      if (nextPanelId) {
        livePanelIds.delete(nextPanelId)
      }
    }

    if (
      Number.isFinite(maxLiveBrowserRuntimes) &&
      livePanelIds.size > maxLiveBrowserRuntimes &&
      Array.from(livePanelIds).every((panelId) => pinnedPanelIds.has(panelId))
    ) {
      console.warn(
        `[browser] Pinned browser runtime count exceeded ${maxLiveBrowserRuntimes}; allowing overflow`
      )
    }

    const nextModes = new Map<string, BrowserRuntimeMode>()
    for (const panel of projectBrowserPanels) {
      if (!livePanelIds.has(panel.panelId)) {
        nextModes.set(panel.panelId, 'cold')
        continue
      }

      if (
        (visibleWorkspaceIds
          ? visibleWorkspaceIds.has(panel.workspaceId)
          : panel.workspaceId === activeWorkspaceId ||
            visibleBackgroundPanelIds.has(panel.panelId))
      ) {
        nextModes.set(panel.panelId, 'visible')
        continue
      }

      nextModes.set(panel.panelId, 'headless')
    }

    return nextModes
  }, [
    activeProjectId,
    activeWorkspaceId,
    browserPanels,
    focusedBrowserPanelId,
    hostEnabled,
    panelRuntimeById,
    runtimePowerMode,
    workspaces
  ])

  const effectiveRuntimeModes = useMemo(() => {
    if (!hostEnabled) {
      return new Map<string, BrowserRuntimeMode>()
    }

    const nextModes = new Map(runtimeModes)
    for (const [panelId, mode] of Object.entries(runtimeModeOverrides)) {
      nextModes.set(panelId, mode)
    }

    return nextModes
  }, [hostEnabled, runtimeModeOverrides, runtimeModes])

  useEffect(() => {
    if (!hostEnabled) {
      setRuntimeModeOverrides((current) =>
        Object.keys(current).length === 0 ? current : {}
      )
      previousDesiredModesRef.current.clear()
      pendingPreviewCapturePanelIdsRef.current.clear()
      runtimeUrlByPanelIdRef.current.clear()
      return
    }

    const runtimeStore = usePanelRuntimeStore.getState()
    const activeBrowserPanelIds = new Set(browserPanels.map((panel) => panel.panelId))
    for (const panel of browserPanels) {
      const nextMode = runtimeModes.get(panel.panelId) ?? 'cold'
      const previousDesiredMode = previousDesiredModesRef.current.get(panel.panelId)
      let effectiveMode = runtimeModeOverrides[panel.panelId] ?? nextMode

      if (
        previousDesiredMode === 'visible' &&
        nextMode !== 'visible' &&
        panelRuntimeById[panel.panelId]?.browserRegisteredInMain &&
        !pendingPreviewCapturePanelIdsRef.current.has(panel.panelId)
      ) {
        effectiveMode = 'visible'
        pendingPreviewCapturePanelIdsRef.current.add(panel.panelId)
        setRuntimeModeOverrides((current) => {
          if (current[panel.panelId] === 'visible') {
            return current
          }

          return {
            ...current,
            [panel.panelId]: 'visible'
          }
        })

        browserApi
          .capturePreview({ panelId: panel.panelId })
          .then((result) => {
            const browserPanelStillActive = useWorkspacesStore
              .getState()
              .activePanels.some(
                (entry) => entry.panelId === panel.panelId && entry.panelType === 'browser'
              )

            if (!browserPanelStillActive) {
              return
            }

            runtimeStore.updatePanelRuntime(panel.panelId, {
              previewDataUrl: result.dataUrl ?? undefined
            })
          })
          .catch(() => {})
          .finally(() => {
            pendingPreviewCapturePanelIdsRef.current.delete(panel.panelId)
            setRuntimeModeOverrides((current) => {
              if (!(panel.panelId in current)) {
                return current
              }

              const nextOverrides = { ...current }
              delete nextOverrides[panel.panelId]
              return nextOverrides
            })
          })
      }
      runtimeStore.updatePanelRuntime(panel.panelId, {
        browserRuntimeMode: effectiveMode
      })
      previousDesiredModesRef.current.set(panel.panelId, nextMode)
    }

    for (const panelId of Array.from(previousDesiredModesRef.current.keys())) {
      if (!activeBrowserPanelIds.has(panelId)) {
        previousDesiredModesRef.current.delete(panelId)
        pendingPreviewCapturePanelIdsRef.current.delete(panelId)
        runtimeUrlByPanelIdRef.current.delete(panelId)
      }
    }

    setRuntimeModeOverrides((current) => {
      const nextOverrides = Object.fromEntries(
        Object.entries(current).filter(([panelId]) => activeBrowserPanelIds.has(panelId))
      ) as Record<string, BrowserRuntimeMode>

      const currentKeys = Object.keys(current)
      const nextKeys = Object.keys(nextOverrides)
      const didChange =
        currentKeys.length !== nextKeys.length ||
        currentKeys.some((key) => current[key] !== nextOverrides[key])

      return didChange ? nextOverrides : current
    })
  }, [browserPanels, hostEnabled, panelRuntimeById, runtimeModeOverrides, runtimeModes])

  useEffect(() => {
    if (!hostEnabled) {
      return
    }

    const hostLayer = hostLayerRef.current
    if (!hostLayer) {
      return
    }

    const activePanelById = new Map(browserPanels.map((panel) => [panel.panelId, panel]))
    const slotByPanelId = new Map(slotEntries.map((entry) => [entry.panelId, entry]))
    const browserUiStore = useBrowserUiStore.getState()
    const runtimeStore = usePanelRuntimeStore.getState()
    const nextManagedIds = new Set<string>()

    const createManagedRuntime = (panelId: string): ManagedRuntime | null => {
      const panel = activePanelById.get(panelId)
      if (!panel || !activeProjectId) {
        return null
      }

      const normalizedUrl = panel.url ?? 'about:blank'
      const isElectron = typeof window !== 'undefined' && typeof window.api !== 'undefined'
      runtimeUrlByPanelIdRef.current.set(panel.panelId, normalizedUrl)
      const element = isElectron
        ? createWebviewElement(panel.panelId, activeProjectId, normalizedUrl)
        : createIframeElement(panel.panelId, normalizedUrl)

      const syncPanelTitle = (nextTitle: string) => {
        const trimmedTitle = nextTitle.trim()
        if (!trimmedTitle) {
          return
        }

        useWorkspacesStore.getState().updatePanelLayout(panel.panelId, {
          panelTitle: trimmedTitle
        })
        browserApi
          .urlChanged({
            panelId: panel.panelId,
            panelTitle: trimmedTitle
          })
          .catch(() => {})
      }

      const cleanupCallbacks: Array<() => void> = []

      if ('getWebContentsId' in element) {
        const webview = element as HTMLWebViewElement
        const handleDidStartLoading = () => {
          browserUiStore.updateBrowserUi(panel.panelId, {
            isLocalLoading: true,
            loadError: null
          })
        }

        const handleDidStopLoading = () => {
          browserUiStore.updateBrowserUi(panel.panelId, {
            isLocalLoading: false,
            canGoBack: webview.canGoBack(),
            canGoForward: webview.canGoForward()
          })
        }

        const handleDidNavigate = (event: { url: string }) => {
          runtimeUrlByPanelIdRef.current.set(panel.panelId, event.url)
          useWorkspacesStore.getState().updatePanelLayout(panel.panelId, { url: event.url })
          browserUiStore.syncUrlFromRuntime(panel.panelId, event.url)
        }

        const handleFailLoad = (event: {
          errorCode: number
          errorDescription: string
          validatedURL: string
          isMainFrame?: boolean
        }) => {
          if (!isFatalBrowserLoadFailure(event)) {
            return
          }

          browserUiStore.updateBrowserUi(panel.panelId, {
            loadError: formatBrowserLoadFailure(event),
            isLocalLoading: false
          })
        }

        const handleTitleUpdated = (event: { title: string }) => {
          syncPanelTitle(event.title)
        }

        const handleDomReady = () => {
          const webContentsId = webview.getWebContentsId()
          runtimeStore.updatePanelRuntime(panel.panelId, {
            browserRegisteredInMain: true,
            browserWebContentsId: webContentsId
          })
          browserApi
            .webviewReady({
              panelId: panel.panelId,
              workspaceId: panel.workspaceId,
              projectId: activeProjectId,
              webContentsId
            })
            .catch(() => {})
        }

        const handleNewWindow = (event: { url: string; preventDefault: () => void }) => {
          event.preventDefault()
          browserApi
            .openTemporary({
              workspaceId: panel.workspaceId,
              projectId: activeProjectId,
              parentPanelId: panel.panelId,
              returnToPanelId: panel.panelId,
              url: event.url,
              width: 350,
              openedBy: 'popup'
            })
            .catch(() => {})
        }

        const handleFocus = () => {
          runtimeStore.markBrowserUserInteraction(panel.panelId)
          browserApi
            .activate({
              workspaceId: panel.workspaceId,
              panelId: panel.panelId
            })
            .catch(() => {})
        }

        webview.addEventListener('did-start-loading', handleDidStartLoading as EventListener)
        webview.addEventListener('did-stop-loading', handleDidStopLoading as EventListener)
        webview.addEventListener('did-navigate', handleDidNavigate as unknown as EventListener)
        webview.addEventListener('did-navigate-in-page', handleDidNavigate as unknown as EventListener)
        webview.addEventListener('did-fail-load', handleFailLoad as unknown as EventListener)
        webview.addEventListener('page-title-updated', handleTitleUpdated as unknown as EventListener)
        webview.addEventListener('dom-ready', handleDomReady as EventListener)
        webview.addEventListener('new-window', handleNewWindow as unknown as EventListener)
        webview.addEventListener('focus', handleFocus as EventListener)

        cleanupCallbacks.push(() => {
          webview.removeEventListener('did-start-loading', handleDidStartLoading as EventListener)
          webview.removeEventListener('did-stop-loading', handleDidStopLoading as EventListener)
          webview.removeEventListener('did-navigate', handleDidNavigate as unknown as EventListener)
          webview.removeEventListener('did-navigate-in-page', handleDidNavigate as unknown as EventListener)
          webview.removeEventListener('did-fail-load', handleFailLoad as unknown as EventListener)
          webview.removeEventListener('page-title-updated', handleTitleUpdated as unknown as EventListener)
          webview.removeEventListener('dom-ready', handleDomReady as EventListener)
          webview.removeEventListener('new-window', handleNewWindow as unknown as EventListener)
          webview.removeEventListener('focus', handleFocus as EventListener)
          browserApi
            .webviewDestroyed({
              panelId: panel.panelId,
              workspaceId: panel.workspaceId,
              projectId: activeProjectId,
              webContentsId:
                usePanelRuntimeStore.getState().panelRuntimeById[panel.panelId]
                  ?.browserWebContentsId
            })
            .catch(() => {})
        })
      } else {
        const iframe = element as HTMLIFrameElement
        const handleLoad = () => {
          runtimeUrlByPanelIdRef.current.set(panel.panelId, iframe.src)
          browserUiStore.updateBrowserUi(panel.panelId, {
            isLocalLoading: false,
            loadError: null
          })
        }

        iframe.addEventListener('load', handleLoad)
        cleanupCallbacks.push(() => {
          iframe.removeEventListener('load', handleLoad)
        })
      }

      hostLayer.appendChild(element)

      return {
        element,
        cleanup: () => {
          for (const callback of cleanupCallbacks) {
            callback()
          }
          runtimeUrlByPanelIdRef.current.delete(panelId)
          element.remove()
        }
      }
    }

    for (const panel of browserPanels) {
      const nextMode = effectiveRuntimeModes.get(panel.panelId) ?? 'cold'
      const managedRuntime = managedRuntimesRef.current.get(panel.panelId)

      if (nextMode === 'cold') {
        if (managedRuntime) {
          managedRuntime.cleanup()
          managedRuntimesRef.current.delete(panel.panelId)
        }
        continue
      }

      nextManagedIds.add(panel.panelId)
      const runtime = managedRuntime ?? createManagedRuntime(panel.panelId)
      if (!runtime) {
        continue
      }

      if (!managedRuntime) {
        managedRuntimesRef.current.set(panel.panelId, runtime)
      }

      const slotEntry = slotByPanelId.get(panel.panelId)
      applyRuntimeBounds(runtime.element, nextMode, slotEntry?.element)

      const nextUrl = panel.url ?? 'about:blank'
      const lastRuntimeUrl = runtimeUrlByPanelIdRef.current.get(panel.panelId) ?? null

      if ('getWebContentsId' in runtime.element) {
        const webview = runtime.element as HTMLWebViewElement
        if (lastRuntimeUrl !== nextUrl) {
          runtimeUrlByPanelIdRef.current.set(panel.panelId, nextUrl)
          webview.setAttribute('src', nextUrl)
        }
      } else {
        const iframe = runtime.element as HTMLIFrameElement
        if (lastRuntimeUrl !== nextUrl) {
          runtimeUrlByPanelIdRef.current.set(panel.panelId, nextUrl)
          iframe.src = nextUrl
        }
      }
    }

    for (const [panelId, managedRuntime] of managedRuntimesRef.current.entries()) {
      if (nextManagedIds.has(panelId)) {
        continue
      }

      managedRuntime.cleanup()
      managedRuntimesRef.current.delete(panelId)
    }
  }, [activeProjectId, browserPanels, effectiveRuntimeModes, hostEnabled, slotEntries])

  useEffect(() => {
    if (!hostEnabled) {
      return
    }

    const activePanelById = new Map(browserPanels.map((panel) => [panel.panelId, panel]))
    for (const command of consumeBrowserRuntimeCommands()) {
      const panel = activePanelById.get(command.panelId)
      const managedRuntime = managedRuntimesRef.current.get(command.panelId)
      if (!panel || !managedRuntime) {
        continue
      }

      const element = managedRuntime.element
      if (command.type === 'navigate') {
        runtimeUrlByPanelIdRef.current.set(command.panelId, command.url)
        if ('getWebContentsId' in element) {
          ;(element as HTMLWebViewElement).loadURL(command.url)
        } else {
          ;(element as HTMLIFrameElement).src = command.url
        }
        continue
      }

      if (command.type === 'focus') {
        element.focus()
        continue
      }

      if (!('getWebContentsId' in element)) {
        continue
      }

      const webview = element as HTMLWebViewElement
      if (command.type === 'reload') {
        webview.reload()
      } else if (command.type === 'stop') {
        webview.stop()
      } else if (command.type === 'back' && webview.canGoBack()) {
        webview.goBack()
      } else if (command.type === 'forward' && webview.canGoForward()) {
        webview.goForward()
      }
    }
  }, [browserPanels, commandNonce, hostEnabled])

  useEffect(() => {
    if (!hostEnabled) {
      return
    }

    let animationFrameId: number | null = null
    const resizeObserver = new ResizeObserver(() => {
      scheduleRuntimeBoundsSync()
    })
    const scrollRoots = new Set<HTMLElement>()

    const syncRuntimeBounds = () => {
      const slotByPanelId = new Map(getBrowserSlots().map((entry) => [entry.panelId, entry]))
      for (const [panelId, runtime] of managedRuntimesRef.current.entries()) {
        const mode = effectiveRuntimeModes.get(panelId) ?? 'cold'
        const slotEntry = slotByPanelId.get(panelId)
        applyRuntimeBounds(runtime.element, mode, slotEntry?.element)
      }
    }

    const scheduleRuntimeBoundsSync = () => {
      if (animationFrameId !== null) {
        return
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null
        syncRuntimeBounds()
      })
    }

    for (const slotEntry of slotEntries) {
      resizeObserver.observe(slotEntry.element)
      const scrollRoot = slotEntry.element.closest('[data-canvas-scroll-root="true"]')
      if (scrollRoot instanceof HTMLElement) {
        scrollRoots.add(scrollRoot)
      }
    }

    for (const scrollRoot of scrollRoots) {
      scrollRoot.addEventListener('scroll', scheduleRuntimeBoundsSync, { passive: true })
    }
    window.addEventListener('resize', scheduleRuntimeBoundsSync)
    scheduleRuntimeBoundsSync()

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
      resizeObserver.disconnect()
      for (const scrollRoot of scrollRoots) {
        scrollRoot.removeEventListener('scroll', scheduleRuntimeBoundsSync)
      }
      window.removeEventListener('resize', scheduleRuntimeBoundsSync)
    }
  }, [effectiveRuntimeModes, hostEnabled, slotEntries])

  useEffect(() => {
    if (!hostEnabled) {
      return
    }

    return () => {
      for (const [, managedRuntime] of managedRuntimesRef.current) {
        managedRuntime.cleanup()
      }
      managedRuntimesRef.current.clear()
      runtimeUrlByPanelIdRef.current.clear()
      previousDesiredModesRef.current.clear()
      pendingPreviewCapturePanelIdsRef.current.clear()
    }
  }, [hostEnabled])

  if (!hostEnabled) {
    return null
  }

  return <div ref={hostLayerRef} className="pointer-events-none fixed inset-0 z-30" />
}
