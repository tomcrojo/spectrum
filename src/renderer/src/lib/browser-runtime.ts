import { nanoid } from 'nanoid'

export type BrowserRuntimeMode = 'visible' | 'headless' | 'cold'

export interface BrowserPanelSnapshot {
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
}

export interface BrowserUiState {
  urlInputDraft: string
  isAddressEditing: boolean
  isLocalLoading: boolean
  loadError: string | null
  canGoBack: boolean
  canGoForward: boolean
}

export interface BrowserSlotRect {
  left: number
  top: number
  width: number
  height: number
}

interface BrowserSlotRegistration {
  panelId: string
  workspaceId: string
  projectId: string
  element: HTMLElement
}

export type BrowserRuntimeCommand =
  | { id: string; panelId: string; type: 'navigate'; url: string }
  | { id: string; panelId: string; type: 'reload' | 'stop' | 'back' | 'forward' | 'focus' }

export type BrowserRuntimeCommandInput =
  | { panelId: string; type: 'navigate'; url: string; id?: string }
  | {
      panelId: string
      type: 'reload' | 'stop' | 'back' | 'forward' | 'focus'
      id?: string
    }

const BROWSER_RUNTIME_HOST_STORAGE_KEY = 'spectrum:browser-runtime-host'

const slotRegistry = new Map<string, BrowserSlotRegistration>()
const slotListeners = new Set<() => void>()
let pendingCommands: BrowserRuntimeCommand[] = []
const commandListeners = new Set<() => void>()

function emitSlotRegistryChange(): void {
  for (const listener of slotListeners) {
    listener()
  }
}

function emitCommandChange(): void {
  for (const listener of commandListeners) {
    listener()
  }
}

export function isBrowserRuntimeHostEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.localStorage.getItem(BROWSER_RUNTIME_HOST_STORAGE_KEY) === 'true' ||
    import.meta.env.VITE_ENABLE_BROWSER_RUNTIME_HOST === 'true'
  )
}

export function registerBrowserSlot(input: BrowserSlotRegistration): () => void {
  slotRegistry.set(input.panelId, input)
  emitSlotRegistryChange()

  return () => {
    const existing = slotRegistry.get(input.panelId)
    if (existing?.element === input.element) {
      slotRegistry.delete(input.panelId)
      emitSlotRegistryChange()
    }
  }
}

export function subscribeBrowserSlots(listener: () => void): () => void {
  slotListeners.add(listener)
  return () => {
    slotListeners.delete(listener)
  }
}

export function getBrowserSlots(): BrowserSlotRegistration[] {
  return Array.from(slotRegistry.values())
}

export function enqueueBrowserRuntimeCommand(
  command: BrowserRuntimeCommandInput
): string {
  const nextCommand = {
    ...command,
    id: command.id ?? nanoid()
  } as BrowserRuntimeCommand

  pendingCommands = [...pendingCommands, nextCommand]
  emitCommandChange()

  return nextCommand.id
}

export function consumeBrowserRuntimeCommands(): BrowserRuntimeCommand[] {
  const nextCommands = pendingCommands
  pendingCommands = []
  return nextCommands
}

export function subscribeBrowserRuntimeCommands(listener: () => void): () => void {
  commandListeners.add(listener)
  return () => {
    commandListeners.delete(listener)
  }
}
