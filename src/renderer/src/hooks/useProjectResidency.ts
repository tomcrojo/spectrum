import { useEffect, useRef } from 'react'
import { T3CODE_CHANNELS } from '@shared/ipc-channels'
import { t3codeApi } from '@renderer/lib/ipc'
import { transport } from '@renderer/lib/transport'
import { playNotificationSound, preloadNotificationSound } from '@renderer/lib/notification-sound'
import { useUiStore } from '@renderer/stores/ui.store'
import { useWorkspacesStore, type ActiveWorkspacePanel } from '@renderer/stores/workspaces.store'
import {
  usePanelRuntimeStore,
  type ThreadNotificationKind
} from '@renderer/stores/panel-runtime.store'
import { useNotificationsStore } from '@renderer/stores/notifications.store'

const RESIDENCY_EVALUATION_INTERVAL_MS = 5_000
const LOW_IDLE_TIMEOUT_MS = 60_000
const MID_IDLE_TIMEOUT_MS = 10 * 60_000
const MID_IDLE_BACKGROUND_PROJECT_LIMIT = 2

type T3WatchPriority = 'focused' | 'active' | 'inactive'

function getPanelProjectId(
  panel: ActiveWorkspacePanel,
  workspaces: ReturnType<typeof useWorkspacesStore.getState>['workspaces']
): string | null {
  return workspaces.find((workspace) => workspace.id === panel.workspaceId)?.projectId ?? null
}

function isProjectBusy(projectId: string): boolean {
  const { activePanels, workspaces } = useWorkspacesStore.getState()
  const { panelRuntimeById } = usePanelRuntimeStore.getState()

  return activePanels.some((panel) => {
    if (getPanelProjectId(panel, workspaces) !== projectId) {
      return false
    }

    const runtime = panelRuntimeById[panel.panelId]
    if (panel.panelType === 'browser') {
      return Boolean(runtime?.browserAutomationAttached)
    }

    if (panel.panelType === 't3code') {
      return (
        runtime?.t3ActivityState === 'starting' ||
        runtime?.t3ActivityState === 'connecting' ||
        runtime?.t3ActivityState === 'running' ||
        runtime?.t3ActivityState === 'requires-input'
      )
    }

    return false
  })
}

function getIdleRetentionPolicy(
  runtimePowerMode: ReturnType<typeof useUiStore.getState>['runtimePowerMode']
): {
  timeoutMs: number
  limit: number | null
} {
  if (runtimePowerMode === 'high') {
    return {
      timeoutMs: Number.POSITIVE_INFINITY,
      limit: null
    }
  }

  if (runtimePowerMode === 'mid') {
    return {
      timeoutMs: MID_IDLE_TIMEOUT_MS,
      limit: MID_IDLE_BACKGROUND_PROJECT_LIMIT
    }
  }

  return {
    timeoutMs: LOW_IDLE_TIMEOUT_MS,
    limit: null
  }
}

export function useProjectResidency(): void {
  const activeProjectId = useUiStore((state) => state.activeProjectId)
  const runtimePowerMode = useUiStore((state) => state.runtimePowerMode)
  const focusedPanelId = useWorkspacesStore((state) => state.focusedPanelId)
  const activePanels = useWorkspacesStore((state) => state.activePanels)
  const workspaces = useWorkspacesStore((state) => state.workspaces)
  const residentProjectIds = useWorkspacesStore((state) => state.residentProjectIds)
  const markProjectVisited = useWorkspacesStore((state) => state.markProjectVisited)
  const activateProjectView = useWorkspacesStore((state) => state.activateProjectView)
  const powerOffProject = useWorkspacesStore((state) => state.powerOffProject)
  const activeWorkspaceId = usePanelRuntimeStore((state) => state.activeWorkspaceId)
  const watchedPanelsRef = useRef<Record<string, { t3ThreadId: string; priority: T3WatchPriority }>>({})

  useEffect(() => {
    preloadNotificationSound()
  }, [])

  useEffect(() => {
    if (!activeProjectId) {
      activateProjectView(null)
      return
    }

    markProjectVisited(activeProjectId)
    activateProjectView(activeProjectId)
  }, [activeProjectId, activateProjectView, markProjectVisited])

  useEffect(() => {
    const desiredWatches: Record<string, { t3ThreadId: string; priority: T3WatchPriority }> = {}

    for (const panel of activePanels) {
      if (panel.panelType !== 't3code' || !panel.t3ThreadId) {
        continue
      }

      const projectId = getPanelProjectId(panel, workspaces)
      if (!projectId || !residentProjectIds.includes(projectId)) {
        continue
      }

      const priority: T3WatchPriority =
        projectId !== activeProjectId
          ? 'active'
          : focusedPanelId === panel.panelId
            ? 'focused'
            : activeWorkspaceId === panel.workspaceId
              ? 'active'
              : 'inactive'

      desiredWatches[panel.panelId] = {
        t3ThreadId: panel.t3ThreadId,
        priority
      }
    }

    for (const [panelId, watch] of Object.entries(desiredWatches)) {
      const current = watchedPanelsRef.current[panelId]
      if (current?.t3ThreadId === watch.t3ThreadId && current.priority === watch.priority) {
        continue
      }

      void t3codeApi.watchThread({
        panelId,
        t3ThreadId: watch.t3ThreadId,
        priority: watch.priority
      })
    }

    for (const panelId of Object.keys(watchedPanelsRef.current)) {
      if (panelId in desiredWatches) {
        continue
      }

      void t3codeApi.unwatchThread(panelId)
    }

    watchedPanelsRef.current = desiredWatches
  }, [activePanels, activeProjectId, activeWorkspaceId, focusedPanelId, residentProjectIds, workspaces])

  useEffect(() => {
    return () => {
      for (const panelId of Object.keys(watchedPanelsRef.current)) {
        void t3codeApi.unwatchThread(panelId)
      }
      watchedPanelsRef.current = {}
    }
  }, [])

  useEffect(() => {
    const remove = transport.on(
      T3CODE_CHANNELS.THREAD_INFO_CHANGED,
      (payload: {
        panelId: string
        t3ThreadId: string
        threadTitle: string | null
        lastUserMessageAt: string | null
        providerId: string | null
        activityState:
          | 'starting'
          | 'connecting'
          | 'running'
          | 'requires-input'
          | 'completed'
          | 'idle'
          | 'unknown'
        notificationKind: ThreadNotificationKind | null
      }) => {
        const workspacesStore = useWorkspacesStore.getState()
        const panel = workspacesStore.activePanels.find((entry) => entry.panelId === payload.panelId)
        if (!panel || panel.panelType !== 't3code') {
          return
        }

        workspacesStore.updatePanelLayout(payload.panelId, {
          providerId: payload.providerId ?? undefined
        })

        const runtimeStore = usePanelRuntimeStore.getState()
        const prevRuntime = runtimeStore.panelRuntimeById[payload.panelId]
        const prevKind = prevRuntime?.t3NotificationKind ?? null

        runtimeStore.updatePanelRuntime(payload.panelId, {
          t3ThreadTitle: payload.threadTitle,
          t3LastUserMessageAt: payload.lastUserMessageAt,
          t3ActivityState: payload.activityState,
          ...(payload.notificationKind
            ? {
                t3NotificationKind: payload.notificationKind,
                t3NotificationUpdatedAt: new Date().toISOString()
              }
            : {
                t3NotificationKind: null
              })
        })

        if (payload.lastUserMessageAt) {
          void workspacesStore.updateWorkspaceLastPanelEditedAt(panel.workspaceId, payload.lastUserMessageAt)
        }

        if (payload.notificationKind && payload.notificationKind !== prevKind) {
          const currentFocusedPanelId = workspacesStore.focusedPanelId
          if (currentFocusedPanelId !== payload.panelId) {
            playNotificationSound()
            useNotificationsStore.getState().addToast({
              panelId: payload.panelId,
              workspaceId: panel.workspaceId,
              panelTitle: panel.panelTitle || payload.threadTitle?.trim() || 'T3Code',
              kind: payload.notificationKind
            })
          }
        }
      }
    )

    return remove
  }, [])

  useEffect(() => {
    let isDisposed = false

    const evaluateResidency = async () => {
      if (isDisposed) {
        return
      }

      const {
        residentProjectIds: currentResidentProjectIds,
        lastVisitedAtByProjectId
      } = useWorkspacesStore.getState()
      const currentActiveProjectId = useUiStore.getState().activeProjectId
      const { timeoutMs, limit } = getIdleRetentionPolicy(useUiStore.getState().runtimePowerMode)
      const now = Date.now()
      const keepProjectIds = new Set<string>()

      if (currentActiveProjectId) {
        keepProjectIds.add(currentActiveProjectId)
      }

      const busyProjectIds = currentResidentProjectIds.filter((projectId) => isProjectBusy(projectId))
      for (const projectId of busyProjectIds) {
        keepProjectIds.add(projectId)
      }

      if (timeoutMs === Number.POSITIVE_INFINITY) {
        for (const projectId of currentResidentProjectIds) {
          keepProjectIds.add(projectId)
        }
      } else {
        const idleResidentProjectIds = currentResidentProjectIds
          .filter((projectId) => !keepProjectIds.has(projectId))
          .map((projectId) => ({
            projectId,
            lastVisitedAt:
              lastVisitedAtByProjectId[projectId] != null
                ? new Date(lastVisitedAtByProjectId[projectId]).getTime()
                : 0
          }))
          .filter(({ lastVisitedAt }) => Number.isFinite(lastVisitedAt) && now - lastVisitedAt <= timeoutMs)
          .sort((left, right) => right.lastVisitedAt - left.lastVisitedAt)

        const retainedIdleProjects =
          typeof limit === 'number'
            ? idleResidentProjectIds.slice(0, limit)
            : idleResidentProjectIds

        for (const entry of retainedIdleProjects) {
          keepProjectIds.add(entry.projectId)
        }
      }

      for (const projectId of currentResidentProjectIds) {
        if (keepProjectIds.has(projectId)) {
          continue
        }

        await powerOffProject(projectId)
      }
    }

    void evaluateResidency()
    const intervalId = window.setInterval(() => {
      void evaluateResidency()
    }, RESIDENCY_EVALUATION_INTERVAL_MS)

    return () => {
      isDisposed = true
      window.clearInterval(intervalId)
    }
  }, [activeProjectId, powerOffProject, runtimePowerMode])
}
