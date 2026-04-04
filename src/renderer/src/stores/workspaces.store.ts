import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { OpenFileInPanelInput, OpenFileInPanelResult } from '@shared/file.types'
import type { BrowserPanelSnapshot } from '@renderer/lib/browser-runtime'
import type {
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceStatus,
  PanelType,
  PanelTitleSource,
  PanelConfig,
  WorkspaceLayoutState,
  PanelOpenedBy
} from '@shared/workspace.types'
import { browserApi, filesApi, workspacesApi } from '@renderer/lib/ipc'
import { useBrowserUiStore } from './browser-ui.store'
import { usePanelRuntimeStore } from './panel-runtime.store'

export interface ActiveWorkspacePanel {
  panelId: string
  workspaceId: string
  workspaceName: string
  cwd: string
  panelType: PanelType
  panelTitle: string
  titleSource?: PanelTitleSource
  hasAutoRenamed?: boolean
  isTemporary?: boolean
  parentPanelId?: string
  returnToPanelId?: string
  openedBy?: PanelOpenedBy
  providerId?: string
  filePath?: string
  cursorLine?: number
  cursorColumn?: number
  t3ProjectId?: string
  t3ThreadId?: string
  url?: string
  width?: number
  height?: number
}

interface WorkspacesState {
  workspaces: Workspace[]
  activePanels: ActiveWorkspacePanel[]
  focusedPanelId: string | null
  focusedBrowserPanelId: string | null
  focusedBrowserPanelByWorkspace: Record<string, string | null>
  lastFocusedPanelByWorkspace: Record<string, string>
  dirtyPanelIds: Record<string, boolean>
  closePanelGuardById: Record<string, () => boolean | Promise<boolean>>

  loadWorkspaces: (projectId: string, includeArchived?: boolean) => Promise<void>
  loadArchivedWorkspaces: (projectId: string) => Promise<void>
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>
  updateWorkspace: (input: UpdateWorkspaceInput) => Promise<Workspace | null>
  deleteWorkspace: (id: string) => Promise<void>
  unloadWorkspace: (id: string) => Promise<void>
  archiveWorkspace: (id: string) => Promise<void>
  unarchiveWorkspace: (id: string) => Promise<Workspace | null>
  reopenWorkspace: (workspaceId: string, cwd: string) => Promise<void>
  setActivePanels: (panels: ActiveWorkspacePanel[]) => void
  addActivePanel: (panel: ActiveWorkspacePanel) => void
  addActivePanelWithoutFocus: (panel: ActiveWorkspacePanel) => void
  insertPanelAfter: (panel: ActiveWorkspacePanel, afterPanelId: string) => void
  insertPanelAfterWithoutFocus: (panel: ActiveWorkspacePanel, afterPanelId: string) => void
  addTemporaryPanelAfter: (panel: ActiveWorkspacePanel, afterPanelId: string) => void
  prependPanelToWorkspace: (panel: ActiveWorkspacePanel) => void
  closeActivePanel: (panelId: string) => void
  requestClosePanel: (panelId: string) => Promise<void>
  setFocusedPanel: (panelId: string | null) => void
  setFocusedBrowserPanel: (panelId: string | null, workspaceId?: string | null) => void
  restoreFocusedBrowserPanel: (fromTemporaryPanelId: string) => void
  focusWorkspace: (workspaceId: string) => void
  reconcileBrowserPanels: (
    panels: BrowserPanelSnapshot[],
    focusedByWorkspace: Record<string, string | null>
  ) => void
  openFilePanel: (input: OpenFileInPanelInput | OpenFileInPanelResult) => Promise<string>
  setPanelDirty: (panelId: string, isDirty: boolean) => void
  registerPanelCloseGuard: (
    panelId: string,
    guard: (() => boolean | Promise<boolean>) | null
  ) => void
  updatePanelLayout: (
    panelId: string,
    patch: Partial<
      Pick<
        ActiveWorkspacePanel,
        | 'url'
        | 'width'
        | 'height'
        | 'panelTitle'
        | 'titleSource'
        | 'hasAutoRenamed'
        | 'providerId'
        | 't3ProjectId'
        | 't3ThreadId'
        | 'filePath'
        | 'cursorLine'
        | 'cursorColumn'
      >
    >
  ) => void
  updateWorkspaceLastPanelEditedAt: (workspaceId: string, timestamp: string) => Promise<void>
  applyAutoTitleToT3CodePanel: (panelId: string, title: string) => Promise<void>
  restorePanelsFromWorkspaces: (workspaces: Workspace[], cwd: string) => void
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const workspaceMutationVersionByProjectId = new Map<string, number>()
const AUTOSAVE_DELAY = 400
const DEFAULT_T3CODE_PANEL_TITLE = 'T3Code'
const DEFAULT_T3CODE_THREAD_TITLE = 'New thread'
const DEFAULT_WORKSPACE_NAME_PATTERN = /^Workspace \d+$/

function getWorkspaceMutationVersion(projectId: string): number {
  return workspaceMutationVersionByProjectId.get(projectId) ?? 0
}

function bumpWorkspaceMutationVersion(projectId: string): number {
  const nextVersion = getWorkspaceMutationVersion(projectId) + 1
  workspaceMutationVersionByProjectId.set(projectId, nextVersion)
  return nextVersion
}

function isWorkspaceStatus(
  value: Workspace['status'],
  status: WorkspaceStatus
): boolean {
  return value === status
}

function isDefaultT3CodePanelTitle(title: string): boolean {
  const trimmed = title.trim()
  return trimmed === DEFAULT_T3CODE_PANEL_TITLE || trimmed === DEFAULT_T3CODE_THREAD_TITLE
}

function canAutoRenameT3CodePanel(panel: ActiveWorkspacePanel): boolean {
  if (panel.panelType !== 't3code' || panel.hasAutoRenamed || panel.titleSource === 'user') {
    return false
  }

  if (panel.titleSource === 'default') {
    return true
  }

  return panel.titleSource === undefined && isDefaultT3CodePanelTitle(panel.panelTitle)
}

function isDefaultWorkspaceName(name: string): boolean {
  return DEFAULT_WORKSPACE_NAME_PATTERN.test(name.trim())
}

function canAutoRenameWorkspace(workspace: Workspace): boolean {
  if (workspace.hasAutoRenamed || workspace.nameSource === 'user') {
    return false
  }

  return workspace.nameSource === 'default' || isDefaultWorkspaceName(workspace.name)
}

function getFilePanelTitle(relativePath: string, filePath: string): string {
  const candidate = relativePath.split('/').at(-1)?.split('\\').at(-1)?.trim()
  if (candidate) {
    return candidate
  }

  return filePath.split('/').at(-1)?.split('\\').at(-1) ?? 'Files'
}

function getProjectRootFromNormalizedPath(path: string, relativePath: string): string {
  if (!relativePath) {
    return path
  }

  const normalizedRelativePath = relativePath.replace(/\\/g, '/')
  const normalizedPath = path.replace(/\\/g, '/')
  const suffix = `/${normalizedRelativePath}`
  if (normalizedPath.endsWith(suffix)) {
    return path.slice(0, path.length - normalizedRelativePath.length - 1)
  }

  return path
}

function buildLayoutState(panels: ActiveWorkspacePanel[]): WorkspaceLayoutState {
  const persistedPanels = panels.filter((panel) => !panel.isTemporary)
  const panelConfigs: PanelConfig[] = persistedPanels.map((panel) => ({
    id: panel.panelId,
    type: panel.panelType,
    title: panel.panelTitle,
    titleSource: panel.titleSource,
    hasAutoRenamed: panel.hasAutoRenamed,
    isTemporary: panel.isTemporary,
    parentPanelId: panel.parentPanelId,
    returnToPanelId: panel.returnToPanelId,
    openedBy: panel.openedBy,
    providerId: panel.providerId,
    filePath: panel.filePath,
    cursorLine: panel.cursorLine,
    cursorColumn: panel.cursorColumn,
    t3ProjectId: panel.t3ProjectId,
    t3ThreadId: panel.t3ThreadId,
    url: panel.url,
    width: panel.width,
    height: panel.height
  }))

  return {
    panels: panelConfigs,
    sizes: panelConfigs.map(() => 1)
  }
}

function serializeLayoutState(layoutState: WorkspaceLayoutState): string {
  return JSON.stringify(layoutState)
}

export function buildPanelsFromWorkspace(workspace: Workspace, cwd: string): ActiveWorkspacePanel[] {
  return workspace.layoutState.panels.map((panel) => ({
    panelId: panel.id,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    cwd,
    panelType: panel.type,
    panelTitle: panel.title,
    titleSource: panel.titleSource,
    hasAutoRenamed: panel.hasAutoRenamed,
    isTemporary: panel.isTemporary,
    parentPanelId: panel.parentPanelId,
    returnToPanelId: panel.returnToPanelId,
    openedBy: panel.openedBy,
    providerId: panel.providerId,
    filePath: panel.filePath,
    cursorLine: panel.cursorLine,
    cursorColumn: panel.cursorColumn,
    t3ProjectId: panel.t3ProjectId,
    t3ThreadId: panel.t3ThreadId,
    url: panel.url,
    width: panel.width,
    height: panel.height
  }))
}

function buildInitialLastFocusedPanelMap(
  panels: ActiveWorkspacePanel[]
): Record<string, string> {
  const lastFocusedPanelByWorkspace: Record<string, string> = {}

  for (const panel of panels) {
    if (!lastFocusedPanelByWorkspace[panel.workspaceId]) {
      lastFocusedPanelByWorkspace[panel.workspaceId] = panel.panelId
    }
  }

  return lastFocusedPanelByWorkspace
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

function getPreferredBrowserPanelId(
  workspaceId: string,
  panels: ActiveWorkspacePanel[],
  preferredPanelId?: string | null
): string | null {
  const workspacePanels = panels.filter(
    (panel) => panel.workspaceId === workspaceId && panel.panelType === 'browser'
  )
  if (workspacePanels.length === 0) {
    return null
  }

  if (
    preferredPanelId &&
    workspacePanels.some((panel) => panel.panelId === preferredPanelId)
  ) {
    return preferredPanelId
  }

  return workspacePanels[0]?.panelId ?? null
}

function insertPanelAtPosition(
  panels: ActiveWorkspacePanel[],
  panel: ActiveWorkspacePanel,
  afterPanelId: string
): ActiveWorkspacePanel[] {
  const idx = panels.findIndex((entry) => entry.panelId === afterPanelId)
  const nextPanels = [...panels]
  if (idx === -1) {
    nextPanels.push(panel)
  } else {
    nextPanels.splice(idx + 1, 0, panel)
  }

  return nextPanels
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
  workspace.name = persistedWorkspace.name
  workspace.nameSource = persistedWorkspace.nameSource
  workspace.hasAutoRenamed = persistedWorkspace.hasAutoRenamed
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

function syncRuntimePanels(panels: ActiveWorkspacePanel[]): void {
  const runtimeStore = usePanelRuntimeStore.getState()
  const browserUiStore = useBrowserUiStore.getState()
  const browserPanelIds: string[] = []
  for (const panel of panels) {
    runtimeStore.ensurePanelRuntime(panel.panelId)
    if (panel.panelType === 'browser') {
      browserPanelIds.push(panel.panelId)
      browserUiStore.ensureBrowserUi(panel.panelId, panel.url)
      if (panel.url) {
        browserUiStore.syncUrlFromRuntime(panel.panelId, panel.url)
      }
    }
  }
  runtimeStore.prunePanels(panels.map((panel) => panel.panelId))
  browserUiStore.pruneBrowserUi(browserPanelIds)
}

function pruneFocusedBrowserPanelMap(
  focusedByWorkspace: Record<string, string | null>,
  panels: ActiveWorkspacePanel[]
): Record<string, string | null> {
  const nextMap: Record<string, string | null> = {}
  const browserPanelIds = new Set(
    panels
      .filter((panel) => panel.panelType === 'browser')
      .map((panel) => panel.panelId)
  )

  for (const [workspaceId, panelId] of Object.entries(focusedByWorkspace)) {
    if (!panelId) {
      continue
    }

    if (browserPanelIds.has(panelId)) {
      nextMap[workspaceId] = panelId
    }
  }

  return nextMap
}

function resolveFocusedBrowserPanelId(
  focusedByWorkspace: Record<string, string | null>,
  panels: ActiveWorkspacePanel[]
): string | null {
  const browserPanelIds = new Set(
    panels
      .filter((panel) => panel.panelType === 'browser')
      .map((panel) => panel.panelId)
  )
  const activeWorkspaceId = usePanelRuntimeStore.getState().activeWorkspaceId

  if (activeWorkspaceId) {
    const activeWorkspaceFocusedPanelId = focusedByWorkspace[activeWorkspaceId]
    if (activeWorkspaceFocusedPanelId && browserPanelIds.has(activeWorkspaceFocusedPanelId)) {
      return activeWorkspaceFocusedPanelId
    }
  }

  for (const panelId of Object.values(focusedByWorkspace)) {
    if (panelId && browserPanelIds.has(panelId)) {
      return panelId
    }
  }

  return null
}

function insertBrowserPanel(
  panels: ActiveWorkspacePanel[],
  panel: ActiveWorkspacePanel
): ActiveWorkspacePanel[] {
  const preferredAfterId = panel.parentPanelId ?? panel.returnToPanelId ?? null
  if (preferredAfterId && panels.some((entry) => entry.panelId === preferredAfterId)) {
    return insertPanelAtPosition(panels, panel, preferredAfterId)
  }

  const workspacePanels = panels.filter((entry) => entry.workspaceId === panel.workspaceId)
  const lastWorkspacePanel = workspacePanels.at(-1)

  if (!lastWorkspacePanel) {
    return [...panels, panel]
  }

  return insertPanelAtPosition(panels, panel, lastWorkspacePanel.panelId)
}

function scheduleSave(workspaceId: string, getState: () => WorkspacesState): void {
  const existing = saveTimers.get(workspaceId)
  if (existing) {
    clearTimeout(existing)
  }

  const timer = setTimeout(() => {
    saveTimers.delete(workspaceId)
    const { activePanels, workspaces } = getState()
    const wsPanels = activePanels.filter((panel) => panel.workspaceId === workspaceId)
    const workspace = workspaces.find((entry) => entry.id === workspaceId)
    if (!workspace) {
      return
    }

    const layoutState = buildLayoutState(wsPanels)
    if (serializeLayoutState(layoutState) === serializeLayoutState(workspace.layoutState)) {
      return
    }

    workspacesApi
      .updateLayout({ id: workspaceId, layoutState })
      .then((persistedWorkspace) => {
        if (persistedWorkspace) {
          syncWorkspaceSnapshot(persistedWorkspace, getState)
        }
      })
      .catch((error) => {
        console.error(`[autosave] Failed to save layout for workspace ${workspaceId}:`, error)
      })
  }, AUTOSAVE_DELAY)

  saveTimers.set(workspaceId, timer)
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

  const { activePanels, workspaces } = getState()
  const workspace = workspaces.find((entry) => entry.id === workspaceId) ?? null
  if (!workspace) {
    return null
  }

  const wsPanels = activePanels.filter((panel) => panel.workspaceId === workspaceId)
  const layoutState = buildLayoutState(wsPanels)
  if (serializeLayoutState(layoutState) === serializeLayoutState(workspace.layoutState)) {
    return workspace
  }

  const persistedWorkspace = await workspacesApi.updateLayout({ id: workspaceId, layoutState })
  if (persistedWorkspace) {
    syncWorkspaceSnapshot(persistedWorkspace, getState)
  }

  return persistedWorkspace ?? workspace
}

function patchChangesPanel(
  panel: ActiveWorkspacePanel,
  patch: Partial<
    Pick<
      ActiveWorkspacePanel,
      | 'url'
      | 'width'
      | 'height'
      | 'panelTitle'
      | 'titleSource'
      | 'hasAutoRenamed'
      | 'providerId'
      | 't3ProjectId'
      | 't3ThreadId'
      | 'filePath'
      | 'cursorLine'
      | 'cursorColumn'
    >
  >
): boolean {
  return Object.entries(patch).some(([key, value]) => {
    const panelKey = key as keyof ActiveWorkspacePanel
    return panel[panelKey] !== value
  })
}

function setActiveWorkspaceFromPanel(panelId: string | null, panels: ActiveWorkspacePanel[]): void {
  const runtimeStore = usePanelRuntimeStore.getState()
  if (!panelId) {
    return
  }

  const panel = panels.find((entry) => entry.panelId === panelId)
  if (panel) {
    runtimeStore.setActiveWorkspaceId(panel.workspaceId)
  }
}

export const useWorkspacesStore = create<WorkspacesState>((set, get) => ({
  workspaces: [],
  activePanels: [],
  focusedPanelId: null,
  focusedBrowserPanelId: null,
  focusedBrowserPanelByWorkspace: {},
  lastFocusedPanelByWorkspace: {},
  dirtyPanelIds: {},
  closePanelGuardById: {},

  loadWorkspaces: async (projectId, includeArchived = false) => {
    const requestVersion = getWorkspaceMutationVersion(projectId)
    const workspaces = await workspacesApi.list({ projectId, includeArchived })
    if (requestVersion !== getWorkspaceMutationVersion(projectId)) {
      return
    }
    set((state) => ({
      workspaces: includeArchived
        ? [
            ...state.workspaces.filter((workspace) => workspace.projectId !== projectId),
            ...workspaces
          ]
        : [
            ...state.workspaces.filter(
              (workspace) =>
                workspace.projectId !== projectId || isWorkspaceStatus(workspace.status, 'archived')
            ),
            ...workspaces
          ]
    }))
  },

  loadArchivedWorkspaces: async (projectId) => {
    await get().loadWorkspaces(projectId, true)
  },

  createWorkspace: async (input) => {
    bumpWorkspaceMutationVersion(input.projectId)
    const workspace = await workspacesApi.create(input)
    set((state) => ({ workspaces: [...state.workspaces, workspace] }))
    return workspace
  },

  updateWorkspace: async (input) => {
    const existingWorkspace = get().workspaces.find((entry) => entry.id === input.id)
    if (existingWorkspace) {
      bumpWorkspaceMutationVersion(existingWorkspace.projectId)
    }
    const workspace = await workspacesApi.update(input)
    if (!workspace) {
      return null
    }

    set((state) => ({
      workspaces: state.workspaces.map((entry) => (entry.id === workspace.id ? workspace : entry)),
      activePanels: state.activePanels.map((panel) =>
        panel.workspaceId === workspace.id ? { ...panel, workspaceName: workspace.name } : panel
      )
    }))

    return workspace
  },

  deleteWorkspace: async (id) => {
    const workspace = get().workspaces.find((entry) => entry.id === id)
    if (!workspace) {
      return
    }

    bumpWorkspaceMutationVersion(workspace.projectId)
    clearPendingSave(id)

    set((state) => {
      const remainingPanels = state.activePanels.filter((panel) => panel.workspaceId !== id)
      const nextFocusedPanelId =
        state.focusedPanelId && remainingPanels.some((panel) => panel.panelId === state.focusedPanelId)
          ? state.focusedPanelId
          : remainingPanels.at(-1)?.panelId ?? null

      syncRuntimePanels(remainingPanels)
      setActiveWorkspaceFromPanel(nextFocusedPanelId, remainingPanels)

      return {
        workspaces: state.workspaces.filter((entry) => entry.id !== id),
        activePanels: remainingPanels,
        focusedPanelId: nextFocusedPanelId,
        focusedBrowserPanelByWorkspace: pruneFocusedBrowserPanelMap(
          state.focusedBrowserPanelByWorkspace,
          remainingPanels
        ),
        focusedBrowserPanelId: resolveFocusedBrowserPanelId(
          pruneFocusedBrowserPanelMap(state.focusedBrowserPanelByWorkspace, remainingPanels),
          remainingPanels
        ),
        dirtyPanelIds: Object.fromEntries(
          Object.entries(state.dirtyPanelIds).filter(([panelId]) =>
            remainingPanels.some((panel) => panel.panelId === panelId)
          )
        ),
        closePanelGuardById: Object.fromEntries(
          Object.entries(state.closePanelGuardById).filter(([panelId]) =>
            remainingPanels.some((panel) => panel.panelId === panelId)
          )
        ),
        lastFocusedPanelByWorkspace: Object.fromEntries(
          Object.entries(state.lastFocusedPanelByWorkspace).filter(([workspaceId]) => workspaceId !== id)
        )
      }
    })

    try {
      await workspacesApi.delete(id)
    } catch (error) {
      console.error(`[workspaces] Failed to delete workspace ${id}:`, error)
      await get().loadWorkspaces(workspace.projectId, true)
    }
  },

  unloadWorkspace: async (id) => {
    const workspace = get().workspaces.find((entry) => entry.id === id)
    if (!workspace) {
      return
    }

    bumpWorkspaceMutationVersion(workspace.projectId)
    await flushWorkspaceLayout(id, get)
    const persistedWorkspace = await workspacesApi.update({ id, status: 'saved' })
    if (!persistedWorkspace) {
      return
    }

    set((state) => {
      const nextPanels = state.activePanels.filter((panel) => panel.workspaceId !== id)
      const nextFocusedPanelId =
        state.focusedPanelId && nextPanels.some((panel) => panel.panelId === state.focusedPanelId)
          ? state.focusedPanelId
          : nextPanels.at(-1)?.panelId ?? null
      const nextFocusedBrowserPanelByWorkspace = pruneFocusedBrowserPanelMap(
        state.focusedBrowserPanelByWorkspace,
        nextPanels
      )

      syncRuntimePanels(nextPanels)
      if (nextFocusedPanelId) {
        setActiveWorkspaceFromPanel(nextFocusedPanelId, nextPanels)
      } else {
        usePanelRuntimeStore.getState().setActiveWorkspaceId(null)
      }

      return {
        workspaces: state.workspaces.map((entry) =>
          entry.id === persistedWorkspace.id ? persistedWorkspace : entry
        ),
        activePanels: nextPanels,
        focusedPanelId: nextFocusedPanelId,
        focusedBrowserPanelByWorkspace: nextFocusedBrowserPanelByWorkspace,
        focusedBrowserPanelId: resolveFocusedBrowserPanelId(
          nextFocusedBrowserPanelByWorkspace,
          nextPanels
        ),
        dirtyPanelIds: Object.fromEntries(
          Object.entries(state.dirtyPanelIds).filter(([panelId]) =>
            nextPanels.some((panel) => panel.panelId === panelId)
          )
        ),
        closePanelGuardById: Object.fromEntries(
          Object.entries(state.closePanelGuardById).filter(([panelId]) =>
            nextPanels.some((panel) => panel.panelId === panelId)
          )
        ),
        lastFocusedPanelByWorkspace: Object.fromEntries(
          Object.entries(state.lastFocusedPanelByWorkspace).filter(([workspaceId]) => workspaceId !== id)
        )
      }
    })
  },

  archiveWorkspace: async (id) => {
    const workspace = get().workspaces.find((entry) => entry.id === id)
    if (workspace) {
      bumpWorkspaceMutationVersion(workspace.projectId)
    }
    await flushWorkspaceLayout(id, get)
    const persistedWorkspace = await workspacesApi.update({ id, status: 'archived' })
    if (!persistedWorkspace) {
      return
    }

    set((state) => {
      const nextPanels = state.activePanels.filter((panel) => panel.workspaceId !== id)
      const nextFocusedPanelId =
        state.focusedPanelId && nextPanels.some((panel) => panel.panelId === state.focusedPanelId)
          ? state.focusedPanelId
          : nextPanels.at(-1)?.panelId ?? null

      syncRuntimePanels(nextPanels)
      setActiveWorkspaceFromPanel(nextFocusedPanelId, nextPanels)

      return {
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === id ? persistedWorkspace : workspace
        ),
        activePanels: nextPanels,
        focusedPanelId: nextFocusedPanelId,
        focusedBrowserPanelByWorkspace: pruneFocusedBrowserPanelMap(
          state.focusedBrowserPanelByWorkspace,
          nextPanels
        ),
        focusedBrowserPanelId: resolveFocusedBrowserPanelId(
          pruneFocusedBrowserPanelMap(state.focusedBrowserPanelByWorkspace, nextPanels),
          nextPanels
        ),
        lastFocusedPanelByWorkspace: Object.fromEntries(
          Object.entries(state.lastFocusedPanelByWorkspace).filter(([workspaceId]) => workspaceId !== id)
        )
      }
    })
  },

  unarchiveWorkspace: async (id) => {
    const existingWorkspace = get().workspaces.find((entry) => entry.id === id)
    if (existingWorkspace) {
      bumpWorkspaceMutationVersion(existingWorkspace.projectId)
    }
    const workspace = await workspacesApi.update({ id, status: 'saved' })
    if (!workspace) {
      return null
    }

    set((state) => ({
      workspaces: state.workspaces.map((entry) => (entry.id === workspace.id ? workspace : entry))
    }))

    return workspace
  },

  reopenWorkspace: async (workspaceId, cwd) => {
    let workspace = get().workspaces.find((entry) => entry.id === workspaceId)
    if (!workspace) {
      return
    }

    bumpWorkspaceMutationVersion(workspace.projectId)
    if (!isWorkspaceStatus(workspace.status, 'active')) {
      const persistedWorkspace = await workspacesApi.update({ id: workspaceId, status: 'active' })
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

    if (workspace.layoutState.panels.length === 0) {
      const layoutState = {
        panels: [
          {
            id: nanoid(),
            type: 't3code' as const,
            title: DEFAULT_T3CODE_PANEL_TITLE,
            titleSource: 'default' as const,
            hasAutoRenamed: false
          }
        ],
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
    if (restoredPanels.length === 0) {
      return
    }

    set((state) => {
      const existingPanelIds = new Set(state.activePanels.map((panel) => panel.panelId))
      const nextPanels = restoredPanels.filter((panel) => !existingPanelIds.has(panel.panelId))
      if (nextPanels.length === 0) {
        return state
      }

      const mergedPanels = [...state.activePanels, ...nextPanels]
      syncRuntimePanels(mergedPanels)
      usePanelRuntimeStore.getState().setActiveWorkspaceId(workspaceId)

      const preferredPanelId =
        getPreferredPanelIdForWorkspace(workspaceId, {
          activePanels: mergedPanels,
          lastFocusedPanelByWorkspace: state.lastFocusedPanelByWorkspace
        }) ?? nextPanels[0]?.panelId ?? null

      return {
        activePanels: mergedPanels,
        focusedPanelId: preferredPanelId,
        focusedBrowserPanelByWorkspace: pruneFocusedBrowserPanelMap(
          state.focusedBrowserPanelByWorkspace,
          mergedPanels
        ),
        focusedBrowserPanelId: resolveFocusedBrowserPanelId(
          pruneFocusedBrowserPanelMap(state.focusedBrowserPanelByWorkspace, mergedPanels),
          mergedPanels
        ),
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
    syncRuntimePanels(panels)
    set({
      activePanels: panels,
      focusedPanelId: null,
      focusedBrowserPanelId: null,
      focusedBrowserPanelByWorkspace: {},
      lastFocusedPanelByWorkspace: buildInitialLastFocusedPanelMap(panels)
    })
  },

  addActivePanel: (panel) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }

      const nextPanels = [...state.activePanels, panel]
      syncRuntimePanels(nextPanels)
      usePanelRuntimeStore.getState().setActiveWorkspaceId(panel.workspaceId)

      return {
        activePanels: nextPanels,
        focusedPanelId: panel.panelId,
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [panel.workspaceId]: panel.panelId
        }
      }
    })
    scheduleSave(panel.workspaceId, get)
  },

  addActivePanelWithoutFocus: (panel) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }

      const nextPanels = [...state.activePanels, panel]
      syncRuntimePanels(nextPanels)
      return {
        activePanels: nextPanels
      }
    })
    scheduleSave(panel.workspaceId, get)
  },

  insertPanelAfter: (panel, afterPanelId) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }

      const nextPanels = insertPanelAtPosition(state.activePanels, panel, afterPanelId)

      syncRuntimePanels(nextPanels)
      usePanelRuntimeStore.getState().setActiveWorkspaceId(panel.workspaceId)

      return {
        activePanels: nextPanels,
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

      const nextPanels = insertPanelAtPosition(state.activePanels, panel, afterPanelId)

      syncRuntimePanels(nextPanels)
      return {
        activePanels: nextPanels
      }
    })
    scheduleSave(panel.workspaceId, get)
  },

  addTemporaryPanelAfter: (panel, afterPanelId) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }

      const nextPanel: ActiveWorkspacePanel = {
        ...panel,
        isTemporary: true,
        openedBy: panel.openedBy ?? 'popup'
      }
      const nextPanels = insertPanelAtPosition(state.activePanels, nextPanel, afterPanelId)
      syncRuntimePanels(nextPanels)

      return {
        activePanels: nextPanels
      }
    })
  },

  prependPanelToWorkspace: (panel) => {
    set((state) => {
      if (state.activePanels.some((existing) => existing.panelId === panel.panelId)) {
        return state
      }

      const firstIdx = state.activePanels.findIndex((entry) => entry.workspaceId === panel.workspaceId)
      const nextPanels = [...state.activePanels]
      if (firstIdx === -1) {
        nextPanels.push(panel)
      } else {
        nextPanels.splice(firstIdx, 0, panel)
      }

      syncRuntimePanels(nextPanels)
      usePanelRuntimeStore.getState().setActiveWorkspaceId(panel.workspaceId)

      return {
        activePanels: nextPanels,
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
    const panel = get().activePanels.find((entry) => entry.panelId === panelId)
    if (panel) {
      const workspacePanels = get().activePanels.filter((entry) => entry.workspaceId === panel.workspaceId)
      if (workspacePanels.length === 1) {
        void get().unloadWorkspace(panel.workspaceId)
        return
      }
    }

    set((state) => {
      const nextPanels = state.activePanels.filter((entry) => entry.panelId !== panelId)
      const nextFocusedPanelId =
        state.focusedPanelId === panelId && panel
          ? getPreferredPanelIdForWorkspace(panel.workspaceId, {
              activePanels: nextPanels,
              lastFocusedPanelByWorkspace: state.lastFocusedPanelByWorkspace
            })
          : state.focusedPanelId

      syncRuntimePanels(nextPanels)
      setActiveWorkspaceFromPanel(nextFocusedPanelId, nextPanels)
      const nextFocusedBrowserPanelByWorkspace = pruneFocusedBrowserPanelMap(
        panel && state.focusedBrowserPanelByWorkspace[panel.workspaceId] === panelId
          ? {
              ...state.focusedBrowserPanelByWorkspace,
              [panel.workspaceId]: getPreferredBrowserPanelId(
                panel.workspaceId,
                nextPanels,
                panel.returnToPanelId ?? panel.parentPanelId ?? null
              )
            }
          : state.focusedBrowserPanelByWorkspace,
        nextPanels
      )

      return {
        activePanels: nextPanels,
        focusedPanelId: nextFocusedPanelId,
        focusedBrowserPanelByWorkspace: nextFocusedBrowserPanelByWorkspace,
        focusedBrowserPanelId: resolveFocusedBrowserPanelId(
          nextFocusedBrowserPanelByWorkspace,
          nextPanels
        ),
        dirtyPanelIds: Object.fromEntries(
          Object.entries(state.dirtyPanelIds).filter(([entryPanelId]) => entryPanelId !== panelId)
        ),
        closePanelGuardById: Object.fromEntries(
          Object.entries(state.closePanelGuardById).filter(([entryPanelId]) => entryPanelId !== panelId)
        ),
        lastFocusedPanelByWorkspace:
          panel && state.lastFocusedPanelByWorkspace[panel.workspaceId] === panelId
            ? (() => {
                const nextPanelId = getPreferredPanelIdForWorkspace(panel.workspaceId, {
                  activePanels: nextPanels,
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
      }
    })

    if (panel) {
      scheduleSave(panel.workspaceId, get)
    }
  },

  requestClosePanel: async (panelId) => {
    const guard = get().closePanelGuardById[panelId]
    if (guard) {
      const allowed = await guard()
      if (!allowed) {
        return
      }
    }

    const panel = get().activePanels.find((entry) => entry.panelId === panelId)
    if (panel?.panelType === 'browser') {
      try {
        const closed = await browserApi.close({
          workspaceId: panel.workspaceId,
          panelId
        })
        if (closed) {
          return
        }
      } catch (error) {
        console.error(`[browser] Failed to close browser panel ${panelId}:`, error)
      }
    }

    get().closeActivePanel(panelId)
  },

  setFocusedPanel: (panelId) => {
    set((state) => {
      if (!panelId) {
        return state.focusedPanelId === null ? state : { focusedPanelId: null }
      }

      const panel = state.activePanels.find((entry) => entry.panelId === panelId)
      if (!panel) {
        return state.focusedPanelId === null ? state : { focusedPanelId: null }
      }

      usePanelRuntimeStore.getState().setActiveWorkspaceId(panel.workspaceId)

      return {
        focusedPanelId: panelId,
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [panel.workspaceId]: panelId
        }
      }
    })
  },

  setFocusedBrowserPanel: (panelId, workspaceId) => {
    set((state) => {
      if (!panelId && !workspaceId) {
        return state.focusedBrowserPanelId === null ? state : { focusedBrowserPanelId: null }
      }

      const panel = panelId
        ? state.activePanels.find((entry) => entry.panelId === panelId)
        : null
      const resolvedWorkspaceId = workspaceId ?? panel?.workspaceId ?? null

      if (panelId && (!panel || panel.panelType !== 'browser' || !resolvedWorkspaceId)) {
        return state
      }

      const nextFocusedBrowserPanelByWorkspace = pruneFocusedBrowserPanelMap(
        resolvedWorkspaceId
          ? {
              ...state.focusedBrowserPanelByWorkspace,
              [resolvedWorkspaceId]: panelId
            }
          : state.focusedBrowserPanelByWorkspace,
        state.activePanels
      )
      const nextFocusedBrowserPanelId = resolveFocusedBrowserPanelId(
        nextFocusedBrowserPanelByWorkspace,
        state.activePanels
      )
      const currentFocusedWorkspaceId = resolvedWorkspaceId
        ? state.focusedBrowserPanelByWorkspace[resolvedWorkspaceId] ?? null
        : null

      return state.focusedBrowserPanelId === nextFocusedBrowserPanelId &&
        currentFocusedWorkspaceId === panelId
        ? state
        : {
            focusedBrowserPanelByWorkspace: nextFocusedBrowserPanelByWorkspace,
            focusedBrowserPanelId: nextFocusedBrowserPanelId
          }
    })
  },

  restoreFocusedBrowserPanel: (fromTemporaryPanelId) => {
    set((state) => {
      const panel = state.activePanels.find((entry) => entry.panelId === fromTemporaryPanelId)
      if (!panel) {
        return state
      }

      const nextFocusedBrowserPanelId = getPreferredBrowserPanelId(
        panel.workspaceId,
        state.activePanels,
        panel.returnToPanelId ?? panel.parentPanelId ?? null
      )
      const nextFocusedBrowserPanelByWorkspace = pruneFocusedBrowserPanelMap(
        {
          ...state.focusedBrowserPanelByWorkspace,
          [panel.workspaceId]: nextFocusedBrowserPanelId
        },
        state.activePanels
      )

      return nextFocusedBrowserPanelId === state.focusedBrowserPanelId
        ? state
        : {
            focusedBrowserPanelByWorkspace: nextFocusedBrowserPanelByWorkspace,
            focusedBrowserPanelId: resolveFocusedBrowserPanelId(
              nextFocusedBrowserPanelByWorkspace,
              state.activePanels
            )
          }
    })
  },

  focusWorkspace: (workspaceId) => {
    set((state) => {
      const panelId = getPreferredPanelIdForWorkspace(workspaceId, state)
      if (!panelId) {
        return state
      }

      usePanelRuntimeStore.getState().setActiveWorkspaceId(workspaceId)

      return {
        focusedPanelId: panelId,
        focusedBrowserPanelId:
          resolveFocusedBrowserPanelId(state.focusedBrowserPanelByWorkspace, state.activePanels),
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [workspaceId]: panelId
        }
      }
    })
  },

  reconcileBrowserPanels: (panels, focusedByWorkspace) => {
    const snapshotById = new Map(panels.map((panel) => [panel.panelId, panel]))
    const runtimeStore = usePanelRuntimeStore.getState()
    useBrowserUiStore.getState().reconcileSnapshots(panels)

    set((state) => {
      let nextPanels = state.activePanels.reduce<ActiveWorkspacePanel[]>((acc, panel) => {
        if (panel.panelType !== 'browser') {
          acc.push(panel)
          return acc
        }

        const snapshot = snapshotById.get(panel.panelId)
        if (!snapshot) {
          if (!runtimeStore.panelRuntimeById[panel.panelId]?.browserRegisteredInMain) {
            acc.push(panel)
          }
          return acc
        }

        acc.push({
          ...panel,
          workspaceId: snapshot.workspaceId,
          panelTitle: snapshot.panelTitle?.trim() || panel.panelTitle,
          isTemporary: snapshot.isTemporary,
          parentPanelId: snapshot.parentPanelId,
          returnToPanelId: snapshot.returnToPanelId,
          openedBy: snapshot.openedBy,
          url: snapshot.url,
          width: snapshot.width,
          height: snapshot.height
        })
        return acc
      }, [])

      for (const snapshot of panels) {
        if (nextPanels.some((panel) => panel.panelId === snapshot.panelId)) {
          continue
        }

        const workspace = state.workspaces.find((entry) => entry.id === snapshot.workspaceId)
        const existingWorkspacePanel = state.activePanels.find(
          (entry) => entry.workspaceId === snapshot.workspaceId
        )

        if (!workspace && !existingWorkspacePanel) {
          continue
        }

        nextPanels = insertBrowserPanel(nextPanels, {
          panelId: snapshot.panelId,
          workspaceId: snapshot.workspaceId,
          workspaceName:
            workspace?.name ?? existingWorkspacePanel?.workspaceName ?? 'Workspace',
          cwd: existingWorkspacePanel?.cwd ?? '',
          panelType: 'browser',
          panelTitle: snapshot.panelTitle?.trim() || 'Browser',
          isTemporary: snapshot.isTemporary,
          parentPanelId: snapshot.parentPanelId,
          returnToPanelId: snapshot.returnToPanelId,
          openedBy: snapshot.openedBy,
          url: snapshot.url,
          width: snapshot.width,
          height: snapshot.height
        })
      }

      syncRuntimePanels(nextPanels)
      const nextFocusedBrowserPanelByWorkspace = pruneFocusedBrowserPanelMap(
        focusedByWorkspace,
        nextPanels
      )

      return {
        activePanels: nextPanels,
        focusedBrowserPanelByWorkspace: nextFocusedBrowserPanelByWorkspace,
        focusedBrowserPanelId: resolveFocusedBrowserPanelId(
          nextFocusedBrowserPanelByWorkspace,
          nextPanels
        )
      }
    })

    for (const panel of panels) {
      runtimeStore.updatePanelRuntime(panel.panelId, {
        browserRegisteredInMain: true
      })
    }
  },

  openFilePanel: async (input) => {
    const normalized =
      'relativePath' in input ? input : await filesApi.openInPanel(input)
    const title = getFilePanelTitle(normalized.relativePath, normalized.path)
    const panelId = nanoid()

    set((state) => {
      const workspace = state.workspaces.find((entry) => entry.id === normalized.workspaceId)
      const workspacePanels = state.activePanels.filter(
        (panel) => panel.workspaceId === normalized.workspaceId
      )
      const projectRoot =
        workspacePanels[0]?.cwd ??
        getProjectRootFromNormalizedPath(normalized.path, normalized.relativePath)

      const nextPanel: ActiveWorkspacePanel = {
        panelId,
        workspaceId: normalized.workspaceId,
        workspaceName: workspace?.name ?? workspacePanels[0]?.workspaceName ?? 'Workspace',
        cwd: projectRoot,
        panelType: 'file',
        panelTitle: title,
        filePath: normalized.path,
        cursorLine: normalized.line,
        cursorColumn: normalized.column
      }

      const focusedPanel = state.focusedPanelId
        ? state.activePanels.find((panel) => panel.panelId === state.focusedPanelId) ?? null
        : null
      const nextPanels = [...state.activePanels]

      if (focusedPanel?.workspaceId === normalized.workspaceId) {
        const focusedIndex = nextPanels.findIndex((panel) => panel.panelId === focusedPanel.panelId)
        nextPanels.splice(focusedIndex + 1, 0, nextPanel)
      } else if (workspacePanels.length > 0) {
        const lastPanel = workspacePanels.at(-1)
        const lastPanelIndex = lastPanel
          ? nextPanels.findIndex((panel) => panel.panelId === lastPanel.panelId)
          : -1

        if (lastPanelIndex >= 0) {
          nextPanels.splice(lastPanelIndex + 1, 0, nextPanel)
        } else {
          nextPanels.push(nextPanel)
        }
      } else {
        nextPanels.push(nextPanel)
      }

      syncRuntimePanels(nextPanels)
      usePanelRuntimeStore.getState().setActiveWorkspaceId(normalized.workspaceId)

      return {
        activePanels: nextPanels,
        focusedPanelId: panelId,
        lastFocusedPanelByWorkspace: {
          ...state.lastFocusedPanelByWorkspace,
          [normalized.workspaceId]: panelId
        }
      }
    })

    scheduleSave(normalized.workspaceId, get)
    return panelId
  },

  setPanelDirty: (panelId, isDirty) => {
    set((state) => {
      const currentlyDirty = Boolean(state.dirtyPanelIds[panelId])
      if (currentlyDirty === isDirty) {
        return state
      }

      const dirtyPanelIds = { ...state.dirtyPanelIds }
      if (isDirty) {
        dirtyPanelIds[panelId] = true
      } else {
        delete dirtyPanelIds[panelId]
      }

      return { dirtyPanelIds }
    })
  },

  registerPanelCloseGuard: (panelId, guard) => {
    set((state) => {
      const closePanelGuardById = { ...state.closePanelGuardById }
      if (guard) {
        closePanelGuardById[panelId] = guard
      } else {
        delete closePanelGuardById[panelId]
      }

      return { closePanelGuardById }
    })
  },

  updatePanelLayout: (panelId, patch) => {
    let workspaceId: string | null = null
    let didChange = false

    set((state) => {
      const nextPanels = state.activePanels.map((panel) => {
        if (panel.panelId !== panelId) {
          return panel
        }

        if (!patchChangesPanel(panel, patch)) {
          return panel
        }

        workspaceId = panel.workspaceId
        didChange = true
        return { ...panel, ...patch }
      })

      return didChange ? { activePanels: nextPanels } : state
    })

    if (workspaceId && didChange) {
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

  applyAutoTitleToT3CodePanel: async (panelId, rawTitle) => {
    const nextTitle = rawTitle.trim()
    if (!nextTitle) {
      return
    }

    let workspaceId: string | null = null
    let shouldRenameWorkspace = false

    set((state) => {
      const panel = state.activePanels.find((entry) => entry.panelId === panelId)
      if (!panel || !canAutoRenameT3CodePanel(panel) || panel.panelTitle === nextTitle) {
        return state
      }

      workspaceId = panel.workspaceId

      return {
        activePanels: state.activePanels.map((entry) =>
          entry.panelId === panelId
            ? {
                ...entry,
                panelTitle: nextTitle,
                titleSource: 'auto',
                hasAutoRenamed: true
              }
            : entry
        ),
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id !== panel.workspaceId) {
            return workspace
          }

          shouldRenameWorkspace = canAutoRenameWorkspace(workspace)

          return {
            ...workspace,
            layoutState: {
              ...workspace.layoutState,
              panels: workspace.layoutState.panels.map((entry) =>
                entry.id === panelId
                  ? {
                      ...entry,
                      title: nextTitle,
                      titleSource: 'auto',
                      hasAutoRenamed: true
                    }
                  : entry
              )
            }
          }
        })
      }
    })

    if (workspaceId) {
      scheduleSave(workspaceId, get)
    }

    if (!workspaceId || !shouldRenameWorkspace) {
      return
    }

    try {
      const persistedWorkspace = await workspacesApi.update({
        id: workspaceId,
        name: nextTitle,
        nameSource: 'auto',
        hasAutoRenamed: true
      })

      if (!persistedWorkspace) {
        return
      }

      set((state) => ({
        workspaces: state.workspaces.map((entry) =>
          entry.id === persistedWorkspace.id ? persistedWorkspace : entry
        ),
        activePanels: state.activePanels.map((entry) =>
          entry.workspaceId === persistedWorkspace.id
            ? { ...entry, workspaceName: persistedWorkspace.name }
            : entry
        )
      }))
    } catch (error) {
      console.error(`[workspaces] Failed to auto-rename workspace ${workspaceId}:`, error)
    }
  },

  restorePanelsFromWorkspaces: (workspaces, cwd) => {
    const panels = workspaces.flatMap((workspace) => buildPanelsFromWorkspace(workspace, cwd))
    syncRuntimePanels(panels)

    set({
      activePanels: panels,
      focusedPanelId: null,
      focusedBrowserPanelId: null,
      focusedBrowserPanelByWorkspace: {},
      lastFocusedPanelByWorkspace: buildInitialLastFocusedPanelMap(panels)
    })
  }
}))
