import { create } from 'zustand'
import type { PanelHydrationState } from '@shared/workspace.types'

const MAX_BROWSER_PREVIEWS = 12

export type ThreadNotificationKind = 'requires-input' | 'completed'

export interface PanelRuntimeState {
  hydrationState: PanelHydrationState
  lastVisibleAt: number | null
  lastHydratedAt: number | null
  previewDataUrl?: string
  browserAutomationAttached: boolean
  browserWebContentsId?: number
  t3ThreadTitle?: string | null
  t3LastUserMessageAt?: string | null
  t3NotificationKind?: ThreadNotificationKind | null
  t3NotificationUpdatedAt?: string | null
  t3NotificationAcknowledgedAt?: string | null
}

interface PanelRuntimeStoreState {
  activeWorkspaceId: string | null
  panelRuntimeById: Record<string, PanelRuntimeState>
  setActiveWorkspaceId: (workspaceId: string | null) => void
  ensurePanelRuntime: (panelId: string) => void
  prunePanels: (panelIds: string[]) => void
  updatePanelRuntime: (panelId: string, patch: Partial<PanelRuntimeState>) => void
  setPanelHydrationState: (panelId: string, hydrationState: PanelHydrationState) => void
  markPanelVisible: (panelId: string) => void
}

function createInitialRuntimeState(): PanelRuntimeState {
  return {
    hydrationState: 'cold',
    lastVisibleAt: null,
    lastHydratedAt: null,
    browserAutomationAttached: false
  }
}

function prunePreviewCache(
  panelRuntimeById: Record<string, PanelRuntimeState>
): Record<string, PanelRuntimeState> {
  const previewEntries = Object.entries(panelRuntimeById)
    .filter(([, value]) => value.previewDataUrl)
    .sort(
      (left, right) =>
        (right[1].lastVisibleAt ?? right[1].lastHydratedAt ?? 0) -
        (left[1].lastVisibleAt ?? left[1].lastHydratedAt ?? 0)
    )

  if (previewEntries.length <= MAX_BROWSER_PREVIEWS) {
    return panelRuntimeById
  }

  const idsToDrop = new Set(previewEntries.slice(MAX_BROWSER_PREVIEWS).map(([panelId]) => panelId))
  const nextState: Record<string, PanelRuntimeState> = {}

  for (const [panelId, value] of Object.entries(panelRuntimeById)) {
    nextState[panelId] =
      idsToDrop.has(panelId) && value.previewDataUrl
        ? { ...value, previewDataUrl: undefined }
        : value
  }

  return nextState
}

export const usePanelRuntimeStore = create<PanelRuntimeStoreState>((set, get) => ({
  activeWorkspaceId: null,
  panelRuntimeById: {},

  setActiveWorkspaceId: (workspaceId) => {
    set((state) =>
      state.activeWorkspaceId === workspaceId ? state : { activeWorkspaceId: workspaceId }
    )
  },

  ensurePanelRuntime: (panelId) => {
    set((state) =>
      state.panelRuntimeById[panelId]
        ? state
        : {
            panelRuntimeById: {
              ...state.panelRuntimeById,
              [panelId]: createInitialRuntimeState()
            }
          }
    )
  },

  prunePanels: (panelIds) => {
    const allowedIds = new Set(panelIds)
    set((state) => {
      const nextEntries = Object.entries(state.panelRuntimeById).filter(([panelId]) =>
        allowedIds.has(panelId)
      )
      const nextRuntime = Object.fromEntries(nextEntries)
      return nextEntries.length === Object.keys(state.panelRuntimeById).length
        ? state
        : { panelRuntimeById: nextRuntime }
    })
  },

  updatePanelRuntime: (panelId, patch) => {
    const current = get().panelRuntimeById[panelId] ?? createInitialRuntimeState()
    const next = { ...current, ...patch }
    const didChange = Object.keys(patch).some(
      (key) => current[key as keyof PanelRuntimeState] !== next[key as keyof PanelRuntimeState]
    )

    if (!didChange) {
      return
    }

    set((state) => ({
      panelRuntimeById: prunePreviewCache({
        ...state.panelRuntimeById,
        [panelId]: next
      })
    }))
  },

  setPanelHydrationState: (panelId, hydrationState) => {
    const now = Date.now()
    const current = get().panelRuntimeById[panelId] ?? createInitialRuntimeState()
    const didHydrationStateChange = current.hydrationState !== hydrationState

    get().updatePanelRuntime(panelId, {
      hydrationState,
      lastHydratedAt:
        hydrationState === 'live'
          ? didHydrationStateChange
            ? now
            : current.lastHydratedAt
          : current.lastHydratedAt,
      lastVisibleAt:
        hydrationState === 'live' || hydrationState === 'preview'
          ? didHydrationStateChange
            ? now
            : current.lastVisibleAt
          : current.lastVisibleAt
    })
  },

  markPanelVisible: (panelId) => {
    get().updatePanelRuntime(panelId, { lastVisibleAt: Date.now() })
  }
}))
