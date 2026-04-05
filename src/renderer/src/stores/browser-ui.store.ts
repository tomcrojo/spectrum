import { create } from 'zustand'
import type { BrowserPanelSnapshot, BrowserUiState } from '@renderer/lib/browser-runtime'

interface BrowserUiStoreState {
  browserUiById: Record<string, BrowserUiState>
  ensureBrowserUi: (panelId: string, url?: string) => void
  pruneBrowserUi: (panelIds: string[]) => void
  updateBrowserUi: (panelId: string, patch: Partial<BrowserUiState>) => void
  setUrlInputDraft: (panelId: string, draft: string) => void
  setAddressEditing: (panelId: string, isAddressEditing: boolean) => void
  syncUrlFromRuntime: (panelId: string, url: string) => void
  reconcileSnapshots: (panels: BrowserPanelSnapshot[]) => void
}

function createInitialBrowserUi(url?: string): BrowserUiState {
  return {
    urlInputDraft: url ?? 'about:blank',
    isAddressEditing: false,
    isLocalLoading: false,
    loadError: null,
    canGoBack: false,
    canGoForward: false
  }
}

export const useBrowserUiStore = create<BrowserUiStoreState>((set, get) => ({
  browserUiById: {},

  ensureBrowserUi: (panelId, url) => {
    set((state) =>
      state.browserUiById[panelId]
        ? state
        : {
            browserUiById: {
              ...state.browserUiById,
              [panelId]: createInitialBrowserUi(url)
            }
          }
    )
  },

  pruneBrowserUi: (panelIds) => {
    const allowedPanelIds = new Set(panelIds)
    set((state) => {
      const nextEntries = Object.entries(state.browserUiById).filter(([panelId]) =>
        allowedPanelIds.has(panelId)
      )
      return nextEntries.length === Object.keys(state.browserUiById).length
        ? state
        : { browserUiById: Object.fromEntries(nextEntries) }
    })
  },

  updateBrowserUi: (panelId, patch) => {
    const current = get().browserUiById[panelId] ?? createInitialBrowserUi()
    const next = { ...current, ...patch }
    const didChange = Object.keys(patch).some(
      (key) => current[key as keyof BrowserUiState] !== next[key as keyof BrowserUiState]
    )

    if (!didChange) {
      return
    }

    set((state) => ({
      browserUiById: {
        ...state.browserUiById,
        [panelId]: next
      }
    }))
  },

  setUrlInputDraft: (panelId, draft) => {
    get().updateBrowserUi(panelId, { urlInputDraft: draft })
  },

  setAddressEditing: (panelId, isAddressEditing) => {
    get().updateBrowserUi(panelId, { isAddressEditing })
  },

  syncUrlFromRuntime: (panelId, url) => {
    const current = get().browserUiById[panelId] ?? createInitialBrowserUi(url)

    get().updateBrowserUi(panelId, {
      urlInputDraft: current.isAddressEditing ? current.urlInputDraft : url
    })
  },

  reconcileSnapshots: (panels) => {
    for (const panel of panels) {
      get().ensureBrowserUi(panel.panelId, panel.url)
      get().syncUrlFromRuntime(panel.panelId, panel.url)
    }
  }
}))
