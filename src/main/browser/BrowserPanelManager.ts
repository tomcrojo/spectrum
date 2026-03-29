import { BrowserWindow } from 'electron'
import { nanoid } from 'nanoid'
import { BROWSER_CHANNELS } from '@shared/ipc-channels'
import { unregisterCdpTarget } from '../cdp/CdpProxyManager'

export interface BrowserPanelState {
  panelId: string
  workspaceId: string
  projectId: string
  url: string
  panelTitle: string
  width?: number
  height?: number
  webContentsId?: number
}

const panelsById = new Map<string, BrowserPanelState>()
const panelIdByWebContentsId = new Map<number, string>()
let mainWindow: BrowserWindow | null = null

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

export function openBrowserPanel(input: {
  workspaceId: string
  projectId: string
  url: string
  width?: number
  height?: number
}): BrowserPanelState {
  const panel: BrowserPanelState = {
    panelId: nanoid(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    url: input.url,
    panelTitle: 'Browser',
    width: input.width,
    height: input.height
  }

  panelsById.set(panel.panelId, panel)
  emitToRenderer(BROWSER_CHANNELS.OPEN, panel)
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
