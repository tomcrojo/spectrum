import { useCallback, useEffect, useRef } from 'react'
import { BROWSER_CHANNELS } from '@shared/ipc-channels'
import { transport } from '@renderer/lib/transport'
import { browserApi } from '@renderer/lib/ipc'
import type { BrowserPanelSnapshot } from '@renderer/lib/browser-runtime'
import { useProjectsStore } from '@renderer/stores/projects.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useBrowserUiStore } from '@renderer/stores/browser-ui.store'
import { useUiStore } from '@renderer/stores/ui.store'

interface BrowserOpenEvent extends BrowserPanelSnapshot {}

interface BrowserNavigateEvent {
  panelId: string
  workspaceId: string
  url: string
}

interface BrowserCloseEvent {
  panelId: string
  workspaceId: string
}

interface BrowserResizeEvent {
  panelId: string
  workspaceId: string
  width: number
  height: number
}

function performBrowserReconcile(projectId: string | null): Promise<void> {
  if (!projectId) {
    useWorkspacesStore.getState().reconcileBrowserPanels([], {})
    return Promise.resolve()
  }

  return useWorkspacesStore
    .getState()
    .loadWorkspaces(projectId, true)
    .then(() =>
      browserApi.snapshot({
        projectId,
        activeWorkspaceId: usePanelRuntimeStore.getState().activeWorkspaceId
      })
    )
    .then((snapshot) => {
      useWorkspacesStore
        .getState()
        .reconcileBrowserPanels(snapshot.panels, snapshot.focusedByWorkspace)

      const runtimeStore = usePanelRuntimeStore.getState()
      const activeBrowserPanelIds = new Set(snapshot.panels.map((panel) => panel.panelId))
      const automationAttachedPanelIds = new Set(snapshot.automationAttachedPanelIds)

      for (const panel of snapshot.panels) {
        runtimeStore.updatePanelRuntime(panel.panelId, {
          browserRegisteredInMain: true,
          browserAutomationAttached: automationAttachedPanelIds.has(panel.panelId)
        })
      }

      for (const panel of useWorkspacesStore.getState().activePanels) {
        if (panel.panelType !== 'browser') {
          continue
        }

        if (!activeBrowserPanelIds.has(panel.panelId)) {
          runtimeStore.updatePanelRuntime(panel.panelId, {
            browserAutomationAttached: false
          })
        }
      }
    })
    .catch((error) => {
      console.error('[browser] Failed to reconcile browser state:', error)
    })
}

export function useBrowserApiListener(): void {
  const activeProjectId = useUiStore((state) => state.activeProjectId)
  const focusedPanelId = useWorkspacesStore((state) => state.focusedPanelId)
  const focusedBrowserPanelId = useWorkspacesStore((state) => state.focusedBrowserPanelId)
  const activePanels = useWorkspacesStore((state) => state.activePanels)
  const reconcileTimerRef = useRef<number | null>(null)
  const pendingProjectIdRef = useRef<string | null>(null)
  const pendingResolversRef = useRef<Array<() => void>>([])
  const inFlightReconcileRef = useRef<Promise<void> | null>(null)

  const resolvePendingReconcileRequests = useCallback(() => {
    const resolvers = pendingResolversRef.current.splice(0)
    for (const resolve of resolvers) {
      resolve()
    }
  }, [])

  const scheduleBrowserReconcile = useCallback(
    (projectId: string | null, delayMs = 75) => {
      if (reconcileTimerRef.current !== null) {
        window.clearTimeout(reconcileTimerRef.current)
        reconcileTimerRef.current = null
      }

      if (!projectId) {
        pendingProjectIdRef.current = null
        return performBrowserReconcile(null).finally(() => {
          resolvePendingReconcileRequests()
        })
      }

      pendingProjectIdRef.current = projectId

      return new Promise<void>((resolve) => {
        pendingResolversRef.current.push(resolve)
        reconcileTimerRef.current = window.setTimeout(() => {
          reconcileTimerRef.current = null

          const runReconcile = async () => {
            if (inFlightReconcileRef.current) {
              await inFlightReconcileRef.current
            }

            const reconcilePromise = performBrowserReconcile(pendingProjectIdRef.current)
            inFlightReconcileRef.current = reconcilePromise

            try {
              await reconcilePromise
            } finally {
              if (inFlightReconcileRef.current === reconcilePromise) {
                inFlightReconcileRef.current = null
              }
            }
          }

          void runReconcile().finally(() => {
            resolvePendingReconcileRequests()
          })
        }, delayMs)
      })
    },
    [resolvePendingReconcileRequests]
  )

  const reconcileActiveProject = useCallback(() => {
    return scheduleBrowserReconcile(useUiStore.getState().activeProjectId, 0)
  }, [scheduleBrowserReconcile])

  useEffect(() => {
    void scheduleBrowserReconcile(activeProjectId, 0)
  }, [activeProjectId, scheduleBrowserReconcile])

  useEffect(() => {
    return () => {
      if (reconcileTimerRef.current !== null) {
        window.clearTimeout(reconcileTimerRef.current)
      }
      resolvePendingReconcileRequests()
    }
  }, [resolvePendingReconcileRequests])

  useEffect(() => {
    const handleWindowFocus = () => {
      void reconcileActiveProject()
    }

    window.addEventListener('focus', handleWindowFocus)
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [reconcileActiveProject])

  useEffect(() => {
    const focusedPanel = focusedPanelId
      ? activePanels.find((panel) => panel.panelId === focusedPanelId)
      : null

    if (!focusedPanel || focusedPanel.panelType !== 'browser') {
      return
    }

    usePanelRuntimeStore.getState().markBrowserUserInteraction(focusedPanel.panelId)

    if (focusedPanel.panelId === focusedBrowserPanelId) {
      return
    }

    browserApi
      .activate({
        workspaceId: focusedPanel.workspaceId,
        panelId: focusedPanel.panelId
      })
      .catch((error) => {
        console.error(
          `[browser] Failed to activate browser panel ${focusedPanel.panelId}:`,
          error
        )
      })
  }, [activePanels, focusedBrowserPanelId, focusedPanelId])

  useEffect(() => {
    const removeOpen = transport.on(BROWSER_CHANNELS.OPEN, (payload: BrowserOpenEvent) => {
      const state = useWorkspacesStore.getState()
      const project = useProjectsStore.getState().projects.find(
        (entry) => entry.id === payload.projectId
      )
      const workspace = state.workspaces.find((entry) => entry.id === payload.workspaceId)

      if (!project || !workspace) {
        void scheduleBrowserReconcile(payload.projectId)
        return
      }

      useBrowserUiStore.getState().ensureBrowserUi(payload.panelId, payload.url)

      if (state.activePanels.some((panel) => panel.panelId === payload.panelId)) {
        state.updatePanelLayout(payload.panelId, {
          url: payload.url,
          width: payload.width,
          height: payload.height,
          panelTitle: payload.panelTitle
        })
        usePanelRuntimeStore.getState().updatePanelRuntime(payload.panelId, {
          browserRegisteredInMain: true
        })
        return
      }

      const nextPanel = {
        panelId: payload.panelId,
        workspaceId: payload.workspaceId,
        workspaceName: workspace.name,
        cwd: project.repoPath,
        panelType: 'browser' as const,
        panelTitle: payload.panelTitle?.trim() || 'Browser',
        isTemporary: payload.isTemporary,
        parentPanelId: payload.parentPanelId,
        returnToPanelId: payload.returnToPanelId,
        openedBy: payload.openedBy,
        url: payload.url,
        width: payload.width,
        height: payload.height
      }

      if (payload.isTemporary && payload.afterPanelId) {
        state.addTemporaryPanelAfter(nextPanel, payload.afterPanelId)
      } else {
        const focusedPanel = state.focusedPanelId
          ? state.activePanels.find((panel) => panel.panelId === state.focusedPanelId)
          : null

        if (focusedPanel && focusedPanel.workspaceId === payload.workspaceId) {
          state.insertPanelAfterWithoutFocus(nextPanel, focusedPanel.panelId)
        } else {
          state.addActivePanelWithoutFocus(nextPanel)
        }
      }

      usePanelRuntimeStore.getState().updatePanelRuntime(payload.panelId, {
        browserRegisteredInMain: true
      })
    })

    const removeNavigate = transport.on(
      BROWSER_CHANNELS.NAVIGATE,
      (payload: BrowserNavigateEvent) => {
        const panel = useWorkspacesStore
          .getState()
          .activePanels.find((entry) => entry.panelId === payload.panelId)

        if (!panel || panel.panelType !== 'browser') {
          void scheduleBrowserReconcile(useUiStore.getState().activeProjectId)
          return
        }

        useWorkspacesStore.getState().updatePanelLayout(payload.panelId, { url: payload.url })
        useBrowserUiStore.getState().syncUrlFromRuntime(payload.panelId, payload.url)
      }
    )

    const removeClose = transport.on(BROWSER_CHANNELS.CLOSE, (payload: BrowserCloseEvent) => {
      const panel = useWorkspacesStore
        .getState()
        .activePanels.find((entry) => entry.panelId === payload.panelId)

      if (!panel || panel.panelType !== 'browser') {
        void scheduleBrowserReconcile(useUiStore.getState().activeProjectId)
        return
      }

      useWorkspacesStore.getState().closeActivePanel(payload.panelId)
    })

    const removeResize = transport.on(BROWSER_CHANNELS.RESIZE, (payload: BrowserResizeEvent) => {
      const panel = useWorkspacesStore
        .getState()
        .activePanels.find((entry) => entry.panelId === payload.panelId)

      if (!panel || panel.panelType !== 'browser') {
        void scheduleBrowserReconcile(useUiStore.getState().activeProjectId)
        return
      }

      useWorkspacesStore.getState().updatePanelLayout(payload.panelId, {
        width: payload.width,
        height: payload.height
      })
    })

    const removeActivate = transport.on(
      BROWSER_CHANNELS.ACTIVATE,
      (payload: { workspaceId: string; panelId: string | null }) => {
        if (!payload.panelId) {
          return
        }

        const panel = useWorkspacesStore
          .getState()
          .activePanels.find((entry) => entry.panelId === payload.panelId)

        if (!panel || panel.panelType !== 'browser') {
          void scheduleBrowserReconcile(useUiStore.getState().activeProjectId)
          return
        }

        usePanelRuntimeStore.getState().markBrowserAgentInteraction(payload.panelId)
      }
    )

    const removeFocusChanged = transport.on(
      BROWSER_CHANNELS.FOCUS_CHANGED,
      (payload: { workspaceId: string; panelId: string | null }) => {
        useWorkspacesStore
          .getState()
          .setFocusedBrowserPanel(payload.panelId, payload.workspaceId)
      }
    )

    const removeAutomationStateChanged = transport.on(
      BROWSER_CHANNELS.AUTOMATION_STATE_CHANGED,
      (payload: { panelId: string; automationAttached: boolean }) => {
        usePanelRuntimeStore.getState().updatePanelRuntime(payload.panelId, {
          browserAutomationAttached: payload.automationAttached
        })
      }
    )

    return () => {
      removeOpen()
      removeNavigate()
      removeClose()
      removeResize()
      removeActivate()
      removeFocusChanged()
      removeAutomationStateChanged()
    }
  }, [reconcileActiveProject, scheduleBrowserReconcile])
}
