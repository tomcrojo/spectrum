import { BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import { BROWSER_CHANNELS } from '@shared/ipc-channels'
import {
  hasAttachedAutomationClients,
  unregisterCdpTarget
} from '../cdp/CdpProxyManager'

export interface BrowserPanelState {
  panelId: string
  workspaceId: string
  projectId: string
  url: string
  panelTitle: string
  isTemporary?: boolean
  parentPanelId?: string
  returnToPanelId?: string
  openedBy?: 'user' | 'agent' | 'popup'
  afterPanelId?: string
  width?: number
  height?: number
  webContentsId?: number
}

export interface BrowserSnapshot {
  panels: BrowserPanelState[]
  focusedBrowserPanelId: string | null
  focusedByWorkspace: Record<string, string | null>
  automationAttachedPanelIds: string[]
}

const panelsById = new Map<string, BrowserPanelState>()
const panelIdByWebContentsId = new Map<number, string>()
const focusedAgentPanelIdByWorkspace = new Map<string, string>()
let mainWindow: BrowserWindow | null = null
const TEMPORARY_BROWSER_PANEL_WIDTH = 350

function emitToRenderer(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }
  mainWindow.webContents.send(channel, payload)
}

export function setBrowserPanelMainWindow(window: BrowserWindow): void {
  mainWindow = window
}

export function clearBrowserPanelMainWindow(): void {
  mainWindow = null
}

export function clearAllBrowserPanels(): void {
  panelsById.clear()
  panelIdByWebContentsId.clear()
  focusedAgentPanelIdByWorkspace.clear()
}

export function openBrowserPanel(input: {
  workspaceId: string
  projectId: string
  url: string
  width?: number
  height?: number
  openedBy?: 'user' | 'agent' | 'popup'
}): BrowserPanelState {
  const panel: BrowserPanelState = {
    panelId: nanoid(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    url: input.url,
    panelTitle: 'Browser',
    openedBy: input.openedBy ?? 'user',
    width: input.width,
    height: input.height
  }

  panelsById.set(panel.panelId, panel)
  focusedAgentPanelIdByWorkspace.set(panel.workspaceId, panel.panelId)
  emitToRenderer(BROWSER_CHANNELS.OPEN, panel)
  emitToRenderer(BROWSER_CHANNELS.FOCUS_CHANGED, {
    workspaceId: panel.workspaceId,
    panelId: panel.panelId
  })
  return panel
}

export function openTemporaryBrowserPanel(input: {
  workspaceId: string
  projectId: string
  url: string
  parentPanelId: string
  returnToPanelId?: string
  width?: number
  height?: number
  openedBy?: 'agent' | 'popup'
}): BrowserPanelState | null {
  const parentPanel = panelsById.get(input.parentPanelId)
  if (!parentPanel || parentPanel.workspaceId !== input.workspaceId) {
    return null
  }

  const panel: BrowserPanelState = {
    panelId: nanoid(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    url: input.url,
    panelTitle: 'Browser',
    isTemporary: true,
    parentPanelId: input.parentPanelId,
    returnToPanelId: input.returnToPanelId ?? input.parentPanelId,
    openedBy: input.openedBy ?? 'popup',
    afterPanelId: input.parentPanelId,
    width: input.width ?? TEMPORARY_BROWSER_PANEL_WIDTH,
    height: input.height
  }

  panelsById.set(panel.panelId, panel)
  focusedAgentPanelIdByWorkspace.set(panel.workspaceId, panel.panelId)
  emitToRenderer(BROWSER_CHANNELS.OPEN, panel)
  emitToRenderer(BROWSER_CHANNELS.FOCUS_CHANGED, {
    workspaceId: panel.workspaceId,
    panelId: panel.panelId
  })
  return panel
}

export function navigateBrowserPanel(
  workspaceId: string,
  panelId: string,
  url: string
): BrowserPanelState | null {
  const panel = panelsById.get(panelId)
  if (!panel || panel.workspaceId !== workspaceId) {
    return null
  }

  panel.url = url
  emitToRenderer(BROWSER_CHANNELS.NAVIGATE, {
    panelId,
    workspaceId,
    url
  })
  return panel
}

export function resizeBrowserPanel(
  workspaceId: string,
  panelId: string,
  width: number,
  height: number
): BrowserPanelState | null {
  const panel = panelsById.get(panelId)
  if (!panel || panel.workspaceId !== workspaceId) {
    return null
  }

  panel.width = width
  panel.height = height
  emitToRenderer(BROWSER_CHANNELS.RESIZE, {
    panelId,
    workspaceId,
    width,
    height
  })
  return panel
}

export function closeBrowserPanel(
  workspaceId: string,
  panelId: string
): BrowserPanelState | null {
  const panel = panelsById.get(panelId)
  if (!panel || panel.workspaceId !== workspaceId) {
    return null
  }

  panelsById.delete(panelId)
  if (focusedAgentPanelIdByWorkspace.get(panel.workspaceId) === panelId) {
    const nextFocusedPanelId = resolveReturnBrowserPanelId(panel)
    if (nextFocusedPanelId) {
      focusedAgentPanelIdByWorkspace.set(panel.workspaceId, nextFocusedPanelId)
    } else {
      focusedAgentPanelIdByWorkspace.delete(panel.workspaceId)
    }
    emitToRenderer(BROWSER_CHANNELS.FOCUS_CHANGED, {
      workspaceId: panel.workspaceId,
      panelId: nextFocusedPanelId
    })
  }
  if (typeof panel.webContentsId === 'number') {
    panelIdByWebContentsId.delete(panel.webContentsId)
    void unregisterCdpTarget({
      workspaceId: panel.workspaceId,
      webContentsId: panel.webContentsId
    })
  }

  emitToRenderer(BROWSER_CHANNELS.CLOSE, {
    panelId,
    workspaceId
  })
  return panel
}

export function listBrowserPanels(workspaceId: string): BrowserPanelState[] {
  return Array.from(panelsById.values()).filter((panel) => panel.workspaceId === workspaceId)
}

export function listBrowserPanelsForProject(projectId: string): BrowserPanelState[] {
  return Array.from(panelsById.values()).filter((panel) => panel.projectId === projectId)
}

export function getFocusedBrowserPanelId(workspaceId: string): string | null {
  return focusedAgentPanelIdByWorkspace.get(workspaceId) ?? null
}

export function getFocusedBrowserPanelMapForProject(
  projectId: string
): Record<string, string | null> {
  const nextMap: Record<string, string | null> = {}

  for (const panel of panelsById.values()) {
    if (!(panel.workspaceId in nextMap)) {
      nextMap[panel.workspaceId] = null
    }
  }

  for (const [workspaceId, panelId] of focusedAgentPanelIdByWorkspace.entries()) {
    const panel = panelsById.get(panelId)
    if (!panel || panel.projectId !== projectId) {
      continue
    }

    nextMap[workspaceId] = panelId
  }

  return nextMap
}

export function getBrowserSnapshot(input: {
  projectId: string | null
  activeWorkspaceId?: string | null
}): BrowserSnapshot {
  if (!input.projectId) {
    return {
      panels: [],
      focusedBrowserPanelId: null,
      focusedByWorkspace: {},
      automationAttachedPanelIds: []
    }
  }

  const panels = listBrowserPanelsForProject(input.projectId)
  const focusedByWorkspace = getFocusedBrowserPanelMapForProject(input.projectId)
  const automationAttachedPanelIds = panels.flatMap((panel) => {
    if (
      typeof panel.webContentsId === 'number' &&
      hasAttachedAutomationClients(panel.workspaceId, panel.webContentsId)
    ) {
      return [panel.panelId]
    }

    return []
  })

  const focusedBrowserPanelId =
    (input.activeWorkspaceId
      ? focusedByWorkspace[input.activeWorkspaceId] ?? null
      : null) ??
    Object.values(focusedByWorkspace).find(
      (panelId): panelId is string => typeof panelId === 'string' && panelId.length > 0
    ) ??
    null

  return {
    panels,
    focusedBrowserPanelId,
    focusedByWorkspace,
    automationAttachedPanelIds
  }
}

export function updateBrowserPanelFromRenderer(input: {
  panelId: string
  url?: string
  panelTitle?: string
}): BrowserPanelState | null {
  const panel = panelsById.get(input.panelId)
  if (!panel) {
    return null
  }

  if (typeof input.url === 'string') {
    panel.url = input.url
  }
  if (typeof input.panelTitle === 'string' && input.panelTitle.trim().length > 0) {
    panel.panelTitle = input.panelTitle.trim()
  }

  return panel
}

export function bindBrowserPanelWebContents(input: {
  panelId: string
  webContentsId: number
}): BrowserPanelState | null {
  const panel = panelsById.get(input.panelId)
  if (!panel) {
    return null
  }

  if (typeof panel.webContentsId === 'number' && panel.webContentsId !== input.webContentsId) {
    panelIdByWebContentsId.delete(panel.webContentsId)
  }

  panel.webContentsId = input.webContentsId
  panelIdByWebContentsId.set(input.webContentsId, input.panelId)
  return panel
}

export function unbindBrowserPanelByWebContentsId(
  webContentsId: number
): BrowserPanelState | null {
  const panelId = panelIdByWebContentsId.get(webContentsId)
  if (!panelId) {
    return null
  }

  panelIdByWebContentsId.delete(webContentsId)
  const panel = panelsById.get(panelId) ?? null
  if (panel) {
    delete panel.webContentsId
  }

  return panel
}

export function getBrowserPanelByWebContentsId(
  webContentsId: number
): BrowserPanelState | null {
  const panelId = panelIdByWebContentsId.get(webContentsId)
  if (!panelId) {
    return null
  }
  return panelsById.get(panelId) ?? null
}

export function getBrowserPanel(panelId: string): BrowserPanelState | null {
  return panelsById.get(panelId) ?? null
}

export function setFocusedBrowserPanel(
  workspaceId: string,
  panelId: string | null
): void {
  if (!panelId) {
    focusedAgentPanelIdByWorkspace.delete(workspaceId)
    emitToRenderer(BROWSER_CHANNELS.FOCUS_CHANGED, {
      workspaceId,
      panelId: null
    })
    return
  }

  const panel = panelsById.get(panelId)
  if (!panel || panel.workspaceId !== workspaceId) {
    return
  }

  focusedAgentPanelIdByWorkspace.set(workspaceId, panelId)
  emitToRenderer(BROWSER_CHANNELS.FOCUS_CHANGED, {
    workspaceId,
    panelId
  })
}

export function activateBrowserPanel(
  workspaceId: string,
  panelId: string
): BrowserPanelState | null {
  const panel = panelsById.get(panelId)
  if (!panel || panel.workspaceId !== workspaceId) {
    return null
  }

  focusedAgentPanelIdByWorkspace.set(workspaceId, panelId)
  emitToRenderer(BROWSER_CHANNELS.ACTIVATE, {
    workspaceId,
    panelId
  })
  emitToRenderer(BROWSER_CHANNELS.FOCUS_CHANGED, {
    workspaceId,
    panelId
  })
  return panel
}

export function ensureBrowserPanelState(input: {
  panelId: string
  workspaceId: string
  projectId: string
  url?: string
  panelTitle?: string
}): BrowserPanelState {
  const existing = panelsById.get(input.panelId)
  if (existing) {
    return existing
  }

  const panel: BrowserPanelState = {
    panelId: input.panelId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    url: input.url ?? 'about:blank',
    panelTitle: input.panelTitle?.trim() || 'Browser'
  }
  panelsById.set(panel.panelId, panel)
  return panel
}

function resolveReturnBrowserPanelId(panel: BrowserPanelState): string | null {
  const preferredIds = [panel.returnToPanelId, panel.parentPanelId]

  for (const preferredId of preferredIds) {
    if (!preferredId) {
      continue
    }

    const preferredPanel = panelsById.get(preferredId)
    if (
      preferredPanel &&
      preferredPanel.workspaceId === panel.workspaceId &&
      preferredPanel.panelId !== panel.panelId
    ) {
      return preferredPanel.panelId
    }
  }

  for (const candidate of panelsById.values()) {
    if (
      candidate.workspaceId === panel.workspaceId &&
      candidate.panelId !== panel.panelId
    ) {
      return candidate.panelId
    }
  }

  return null
}
