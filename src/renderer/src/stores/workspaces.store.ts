import { create } from 'zustand'
import type {
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  PanelType,
  PanelConfig,
  WorkspaceLayoutState
} from '@shared/workspace.types'
import { workspacesApi } from '@renderer/lib/ipc'
import { nanoid } from 'nanoid'

export interface ActiveWorkspacePanel {
  panelId: string
  workspaceId: string
  workspaceName: string
  cwd: string
  panelType: PanelType
  panelTitle: string
  /** Browser URL — kept in sync with navigation events */
  url?: string
  /** Panel width in px */
  width?: number
  /** Panel height in px */
  height?: number
}

interface WorkspacesState {
  workspaces: Workspace[]
  activePanels: ActiveWorkspacePanel[]
  /** The panel that currently has focus (last clicked/interacted with) */
  focusedPanelId: string | null
  /** Remembers the last focused panel per workspace */
  lastFocusedPanelByWorkspace: Record<string, string>

  loadWorkspaces: (projectId: string) => Promise<void>
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>
  updateWorkspace: (input: UpdateWorkspaceInput) => Promise<Workspace | null>
  deleteWorkspace: (id: string) => Promise<void>
  archiveWorkspace: (id: string) => Promise<void>
  unarchiveWorkspace: (id: string) => Promise<Workspace | null>
  reopenWorkspace: (workspaceId: string, cwd: string) => Promise<void>
  setActivePanels: (panels: ActiveWorkspacePanel[]) => void
  addActivePanel: (panel: ActiveWorkspacePanel) => void
  addActivePanelWithoutFocus: (panel: ActiveWorkspacePanel) => void
  /** Insert a panel right after the given panel ID (used for focus-aware insertion) */
  insertPanelAfter: (panel: ActiveWorkspacePanel, afterPanelId: string) => void
  insertPanelAfterWithoutFocus: (panel: ActiveWorkspacePanel, afterPanelId: string) => void
  /** Prepend a panel at the start of a workspace (before all existing panels) */
  prependPanelToWorkspace: (panel: ActiveWorkspacePanel) => void
  closeActivePanel: (panelId: string) => void
  /** Set which panel currently has focus */
  setFocusedPanel: (panelId: string | null) => void
  /** Focus the preferred panel for a workspace */
  focusWorkspace: (workspaceId: string) => void

  /** Update a single panel's properties (size, url, title) — triggers autosave */
  updatePanel: (panelId: string, patch: Partial<Pick<ActiveWorkspacePanel, 'url' | 'width' | 'height' | 'panelTitle'>>) => void
  updateWorkspaceLastPanelEditedAt: (workspaceId: string, timestamp: string) => Promise<void>

  /** Restore all saved panels from workspace layout states (called on project load) */
  restorePanelsFromWorkspaces: (workspaces: Workspace[], cwd: string) => void
}

// ---------------------------------------------------------------------------
// Debounced autosave — batches layout writes to SQLite
// ---------------------------------------------------------------------------

/** Map of workspaceId → pending timeout handle */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** Debounce delay in ms — short enough to feel instant, long enough to batch rapid changes */
const AUTOSAVE_DELAY = 400

/**
 * Build a WorkspaceLayoutState from the currently active panels for one workspace.
 */
function buildLayoutState(panels: ActiveWorkspacePanel[]): WorkspaceLayoutState {
  const panelConfigs: PanelConfig[] = panels.map((p) => ({
    id: p.panelId,
    type: p.panelType,
    title: p.panelTitle,
    url: p.url,
    width: p.width,
    height: p.height
  }))
  return { panels: panelConfigs, sizes: panelConfigs.map(() => 1) }
}

function serializeLayoutState(layoutState: WorkspaceLayoutState): string {
  return JSON.stringify(layoutState)
}

function buildPanelsFromWorkspace(
  workspace: Workspace,
  cwd: string
): ActiveWorkspacePanel[] {
  return workspace.layoutState.panels.map((panel) => ({
    panelId: panel.id,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    cwd,
    panelType: panel.type,
    panelTitle: panel.title,
    url: panel.url,
    width: panel.width,
    height: panel.height
  }))
}

function getPreferredPanelIdForWorkspace(
  workspaceId: string,
  state: Pick<WorkspacesState, 'activePanels' | 'lastFocusedPanelByWorkspace'>
): string | null {
  const workspacePanels = state.activePanels.filter((panel) => panel.workspaceId === workspaceId)
  if (workspacePanels.length === 0) {
    return null
  }

  const rememberedPanelId = state.lastFocusedPanelByWorkspace[workspaceId]
  if (rememberedPanelId && workspacePanels.some((panel) => panel.panelId === rememberedPanelId)) {
    return rememberedPanelId
  }

  return workspacePanels[0]?.panelId ?? null
}

function syncWorkspaceSnapshot(
  persistedWorkspace: Workspace,
  getState: () => WorkspacesState
): void {
  const workspace = getState().workspaces.find((entry) => entry.id === persistedWorkspace.id)
  if (!workspace) {
    return
  }

  workspace.layoutState = persistedWorkspace.layoutState
  workspace.updatedAt = persistedWorkspace.updatedAt
  workspace.lastPanelEditedAt = persistedWorkspace.lastPanelEditedAt
}

function isNewerTimestamp(
  nextTimestamp: string,
  currentTimestamp: string | null | undefined
): boolean {
  const nextValue = new Date(nextTimestamp).getTime()
  if (Number.isNaN(nextValue)) {
    return false
  }

  if (!currentTimestamp) {
    return true
  }

  const currentValue = new Date(currentTimestamp).getTime()
  if (Number.isNaN(currentValue)) {
    return true
  }

  return nextValue > currentValue
}

/**
 * Schedule a debounced layout save for the given workspace.
 * If a save is already pending for this workspace it gets replaced.
 */
function scheduleSave(workspaceId: string, getState: () => WorkspacesState): void {
  const existing = saveTimers.get(workspaceId)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    saveTimers.delete(workspaceId)
    const { activePanels, workspaces } = getState()
    const wsPanels = activePanels.filter((p) => p.workspaceId === workspaceId)
    const workspace = workspaces.find((w) => w.id === workspaceId)
    if (!workspace) return

    const layoutState = buildLayoutState(wsPanels)
    if (serializeLayoutState(layoutState) === serializeLayoutState(workspace.layoutState)) {
      return
    }

    workspacesApi
      .updateLayout({ id: workspaceId, layoutState })
      .then((persistedWorkspace) => {
        if (!persistedWorkspace) {
          return
        }

        syncWorkspaceSnapshot(persistedWorkspace, getState)
      })
      .catch((err) => {
        console.error(`[autosave] Failed to save layout for workspace ${workspaceId}:`, err)
      })
  }, AUTOSAVE_DELAY)

  saveTimers.set(workspaceId, timer)
}

/**
 * Schedule saves for every workspace that has active panels.
 */
function scheduleAffectedSaves(
  panels: ActiveWorkspacePanel[],
  getState: () => WorkspacesState
): void {
  const workspaceIds = new Set(panels.map((p) => p.workspaceId))
  for (const wsId of workspaceIds) {
    scheduleSave(wsId, getState)
  }
}

function clearPendingSave(workspaceId: string): void {
  const existing = saveTimers.get(workspaceId)
  if (!existing) {
    return
  }

  clearTimeout(existing)
  saveTimers.delete(workspaceId)
}

async function flushWorkspaceLayout(
  workspaceId: string,
  getState: () => WorkspacesState
): Promise<Workspace | null> {
  const existing = saveTimers.get(workspaceId)
  if (existing) {
    clearTimeout(existing)
    saveTimers.delete(workspaceId)
  }
  const hadPendingSave = Boolean(existing)

  const { activePanels, workspaces } = getState()
  const workspace = workspaces.find((entry) => entry.id === workspaceId) ?? null
  if (!workspace) {
    return null
  }

  const wsPanels = activePanels.filter((panel) => panel.workspaceId === workspaceId)
  const layoutState = buildLayoutState(wsPanels)
  if (
    !hadPendingSave &&
    serializeLayoutState(layoutState) === serializeLayoutState(workspace.layoutState)
  ) {
    return workspace
  }

  const persistedWorkspace = await workspacesApi.updateLayout({ id: workspaceId, layoutState })
  if (persistedWorkspace) {
    syncWorkspaceSnapshot(persistedWorkspace, getState)
  }

  return persistedWorkspace ?? workspace
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkspacesStore = create<WorkspacesState>((set, get) => ({
  workspaces: [],
  activePanels: [],
  focusedPanelId: null,
  lastFocusedPanelByWorkspace: {},

  loadWorkspaces: async (projectId) => {
    const workspaces = await workspacesApi.list({ projectId, includeArchived: true })
    set({ workspaces })
  },

  createWorkspace: async (input) => {
    const workspace = await workspacesApi.create(input)
    set((state) => ({ workspaces: [...state.workspaces, workspace] }))
    return workspace
  },

  updateWorkspace: async (input) => {
    const workspace = await workspacesApi.update(input)
    if (!workspace) {
      return null
    }

    set((state) => ({
      workspaces: state.workspaces.map((entry) =>
        entry.id === workspace.id ? workspace : entry
      ),
      activePanels: state.activePanels.map((panel) =>
        panel.workspaceId === workspace.id
          ? { ...panel, workspaceName: workspace.name }
          : panel
      )
    }))

    return workspace
  },

  deleteWorkspace: async (id) => {
    const workspace = get().workspaces.find((entry) => entry.id === id)
    if (!workspace) {
      return
    }

    clearPendingSave(id)

    set((state) => {
      const remainingPanels = state.activePanels.filter((panel) => panel.workspaceId !== id)
      const nextFocusedPanelId =
        state.focusedPanelId && remainingPanels.some((panel) => panel.panelId === state.focusedPanelId)
          ? state.focusedPanelId
          : remainingPanels.at(-1)?.panelId ?? null

      return {
        workspaces: state.workspaces.filter((entry) => entry.id !== id),
        activePanels: remainingPanels,
        focusedPanelId: nextFocusedPanelId,
        lastFocusedPanelByWorkspace: Object.fromEntries(
          Object.entries(state.lastFocusedPanelByWorkspace).filter(([workspaceId]) => workspaceId !== id)
        )
      }
    })

    try {
      await workspacesApi.delete(id)
    } catch (err) {
      console.error(`[workspaces] Failed to delete workspace ${id}:`, err)
      await get().loadWorkspaces(workspace.projectId)
    }
  },

  archiveWorkspace: async (id) => {
    const persistedWorkspace = await flushWorkspaceLayout(id, get)
    await workspacesApi.archive(id)
    const archivedAt = new Date().toISOString()
    set((state) => ({
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === id
          ? {
              ...(persistedWorkspace ?? workspace),
              archived: true,
              updatedAt: archivedAt
            }
          : workspace
      ),
      activePanels: state.activePanels.filter((panel) => panel.workspaceId !== id),
      focusedPanelId:
        state.focusedPanelId &&
        state.activePanels.some(
          (panel) => panel.panelId === state.focusedPanelId && panel.workspaceId === id
        )
          ? null
          : state.focusedPanelId,
      lastFocusedPanelByWorkspace: Object.fromEntries(
        Object.entries(state.lastFocusedPanelByWorkspace).filter(([workspaceId]) => workspaceId !== id)
      )
    }))
  },

  unarchiveWorkspace: async (id) => {
    const workspace = await workspacesApi.update({ id, archived: false })
    if (!workspace) {
      return null
    }

    set((state) => ({
      workspaces: state.workspaces.map((entry) =>
        entry.id === workspace.id ? workspace : entry
      )
    }))

    return workspace
  },

  reopenWorkspace: async (workspaceId, cwd) => {
    let workspace = get().workspaces.find((entry) => entry.id === workspaceId)
    if (!workspace) return

    if (workspace.layoutState.panels.length === 0) {
      const layoutState = {
        panels: [{ id: nanoid(), type: 't3code' as const, title: 'T3Code' }],
        sizes: [1]
      }
      const persistedWorkspace = await workspacesApi.updateLayout({ id: workspaceId, layoutState })
      if (!persistedWorkspace) {
        return
      }

      set((state) => ({
        workspaces: state.workspaces.map((entry) =>
          entry.id === persistedWorkspace.id ? persistedWorkspace : entry
        )
      }))

      workspace = persistedWorkspace
    }

    const restoredPanels = buildPanelsFromWorkspace(workspace, cwd)
    if (restoredPanels.length === 0) return

    set((state) => {
      const existingPanelIds = new Set(state.activePanels.map((panel) => panel.panelId))
      const nextPanels = restoredPanels.filter((panel) => !existingPanelIds.has(panel.panelId))
      if (nextPanels.length === 0) {
        return state
      }

      const preferredPanelId =
        getPreferredPanelIdForWorkspace(workspaceId, {
          activePanels: [...state.activePanels, ...nextPanels],
          lastFocusedPanelByWorkspace: state.lastFocusedPanelByWorkspace
        }) ?? nextPanels.at(-1)?.panelId ?? null

      return {
        activePanels: [...state.activePanels, ...nextPanels],
        focusedPanelId: preferredPanelId ?? state.focusedPanelId,
        lastFocusedPanelByWorkspace:
          preferredPanelId
            ? {
                ...state.lastFocusedPanelByWorkspace,
                [workspaceId]: preferredPanelId
              }
            : state.lastFocusedPanelByWorkspace
      }
    })
  },

  setActivePanels: (panels) => {
    const focusedPanelId = panels[0]?.panelId ?? null
    const lastFocusedPanelByWorkspace =
      focusedPanelId && panels[0]
        ? {
            [panels[0].workspaceId]: focusedPanelId
          }
        : {}

    set({ activePanels: panels, focusedPanelId, lastFocusedPanelByWorkspace })
    // When clearing panels (project switch), don't save empty state
    // When restoring panels, the layout is already in sync
  },

  addActivePanel: (panel) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }
      return {
        activePanels: [...state.activePanels, panel],
        focusedPanelId: panel.panelId,
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [panel.workspaceId]: panel.panelId
        }
      }
    })
    // Schedule save for the workspace this panel belongs to
    scheduleSave(panel.workspaceId, get)
  },

  addActivePanelWithoutFocus: (panel) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }
      return {
        activePanels: [...state.activePanels, panel]
      }
    })
    scheduleSave(panel.workspaceId, get)
  },

  insertPanelAfter: (panel, afterPanelId) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }
      const idx = state.activePanels.findIndex((p) => p.panelId === afterPanelId)
      if (idx === -1) {
        // Fallback: append
        return {
          activePanels: [...state.activePanels, panel],
          focusedPanelId: panel.panelId,
          lastFocusedPanelByWorkspace: {
            ...state.lastFocusedPanelByWorkspace,
            [panel.workspaceId]: panel.panelId
          }
        }
      }
      const newPanels = [...state.activePanels]
      newPanels.splice(idx + 1, 0, panel)
      return {
        activePanels: newPanels,
        focusedPanelId: panel.panelId,
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [panel.workspaceId]: panel.panelId
        }
      }
    })
    scheduleSave(panel.workspaceId, get)
  },

  insertPanelAfterWithoutFocus: (panel, afterPanelId) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }
      const idx = state.activePanels.findIndex((p) => p.panelId === afterPanelId)
      if (idx === -1) {
        return {
          activePanels: [...state.activePanels, panel]
        }
      }
      const newPanels = [...state.activePanels]
      newPanels.splice(idx + 1, 0, panel)
      return {
        activePanels: newPanels
      }
    })
    scheduleSave(panel.workspaceId, get)
  },

  prependPanelToWorkspace: (panel) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }
      // Find the first panel in this workspace and insert before it
      const firstIdx = state.activePanels.findIndex((p) => p.workspaceId === panel.workspaceId)
      if (firstIdx === -1) {
        // No panels in this workspace yet — just append
        return {
          activePanels: [...state.activePanels, panel],
          focusedPanelId: panel.panelId,
          lastFocusedPanelByWorkspace: {
            ...state.lastFocusedPanelByWorkspace,
            [panel.workspaceId]: panel.panelId
          }
        }
      }
      const newPanels = [...state.activePanels]
      newPanels.splice(firstIdx, 0, panel)
      return {
        activePanels: newPanels,
        focusedPanelId: panel.panelId,
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [panel.workspaceId]: panel.panelId
        }
      }
    })
    scheduleSave(panel.workspaceId, get)
  },

  closeActivePanel: (panelId) => {
    const panel = get().activePanels.find((p) => p.panelId === panelId)
    if (panel) {
      const workspacePanels = get().activePanels.filter((entry) => entry.workspaceId === panel.workspaceId)
      if (workspacePanels.length === 1) {
        void get().deleteWorkspace(panel.workspaceId)
        return
      }
    }

    set((state) => ({
      activePanels: state.activePanels.filter((p) => p.panelId !== panelId),
      focusedPanelId:
        state.focusedPanelId === panelId && panel
          ? getPreferredPanelIdForWorkspace(panel.workspaceId, {
              activePanels: state.activePanels.filter((p) => p.panelId !== panelId),
              lastFocusedPanelByWorkspace: state.lastFocusedPanelByWorkspace
            })
          : state.focusedPanelId,
      lastFocusedPanelByWorkspace:
        panel && state.lastFocusedPanelByWorkspace[panel.workspaceId] === panelId
          ? (() => {
              const nextPanelId = getPreferredPanelIdForWorkspace(panel.workspaceId, {
                activePanels: state.activePanels.filter((p) => p.panelId !== panelId),
                lastFocusedPanelByWorkspace: state.lastFocusedPanelByWorkspace
              })

              if (!nextPanelId) {
                return Object.fromEntries(
                  Object.entries(state.lastFocusedPanelByWorkspace).filter(
                    ([workspaceId]) => workspaceId !== panel.workspaceId
                  )
                )
              }

              return {
                ...state.lastFocusedPanelByWorkspace,
                [panel.workspaceId]: nextPanelId
              }
            })()
          : state.lastFocusedPanelByWorkspace
    }))
    // Save the workspace after removing the panel
    if (panel) {
      scheduleSave(panel.workspaceId, get)
    }
  },

  setFocusedPanel: (panelId) => {
    set((state) => {
      if (!panelId) {
        return { focusedPanelId: null }
      }

      const panel = state.activePanels.find((entry) => entry.panelId === panelId)
      if (!panel) {
        return { focusedPanelId: null }
      }

      return {
        focusedPanelId: panelId,
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [panel.workspaceId]: panelId
        }
      }
    })
  },

  focusWorkspace: (workspaceId) => {
    set((state) => {
      const panelId = getPreferredPanelIdForWorkspace(workspaceId, state)
      if (!panelId) {
        return state
      }

      return {
        focusedPanelId: panelId,
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [workspaceId]: panelId
        }
      }
    })
  },

  updatePanel: (panelId, patch) => {
    let workspaceId: string | null = null
    set((state) => {
      const newPanels = state.activePanels.map((p) => {
        if (p.panelId !== panelId) return p
        workspaceId = p.workspaceId
        return { ...p, ...patch }
      })
      return { activePanels: newPanels }
    })
    if (workspaceId) {
      scheduleSave(workspaceId, get)
    }
  },

  updateWorkspaceLastPanelEditedAt: async (workspaceId, timestamp) => {
    const workspace = get().workspaces.find((entry) => entry.id === workspaceId)
    if (!workspace || !isNewerTimestamp(timestamp, workspace.lastPanelEditedAt)) {
      return
    }

    const persistedWorkspace = await workspacesApi.updateLastPanelEditedAt({
      id: workspaceId,
      timestamp
    })

    if (!persistedWorkspace) {
      return
    }

    set((state) => ({
      workspaces: state.workspaces.map((entry) =>
        entry.id === persistedWorkspace.id ? persistedWorkspace : entry
      )
    }))
  },

  restorePanelsFromWorkspaces: (workspaces, cwd) => {
    const panels: ActiveWorkspacePanel[] = []
    for (const ws of workspaces) {
      panels.push(...buildPanelsFromWorkspace(ws, cwd))
    }

    const focusedPanelId = panels[0]?.panelId ?? null
    const lastFocusedPanelByWorkspace =
      focusedPanelId && panels[0]
        ? {
            [panels[0].workspaceId]: focusedPanelId
          }
        : {}

    set({ activePanels: panels, focusedPanelId, lastFocusedPanelByWorkspace })
  }
}))
