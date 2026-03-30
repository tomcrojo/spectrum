import { create } from 'zustand'

export type UiTheme = 'light' | 'dark' | 'system'
export type ArchivedTimestampFormat = 'relative' | 'full'
export type CanvasInteractionMode = 'structured' | 'free'
export type RuntimePowerMode = 'low' | 'mid' | 'high'
export type FollowUpBehavior = 'queue' | 'steer'

const THEME_STORAGE_KEY = 'centipede:theme'
const ARCHIVED_TIMESTAMP_FORMAT_STORAGE_KEY = 'centipede:archived-timestamp-format'
const AUTO_CENTER_FOCUSED_PANEL_STORAGE_KEY = 'centipede:auto-center-focused-panel'
const CANVAS_INTERACTION_MODE_STORAGE_KEY = 'centipede:canvas-interaction-mode'
const RUNTIME_POWER_MODE_STORAGE_KEY = 'centipede:runtime-power-mode'
const FOLLOW_UP_BEHAVIOR_STORAGE_KEY = 'centipede:follow-up-behavior'
export const CANVAS_ZOOM_STORAGE_KEY = 'centipede:canvas-zoom'
export const CANVAS_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const

const MIN_CANVAS_ZOOM = CANVAS_ZOOM_STEPS[0]
const MAX_CANVAS_ZOOM = CANVAS_ZOOM_STEPS[CANVAS_ZOOM_STEPS.length - 1]

function clampCanvasZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return 1
  }

  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, Number(zoom.toFixed(3))))
}

function persistCanvasZoom(zoom: number) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CANVAS_ZOOM_STORAGE_KEY, String(clampCanvasZoom(zoom)))
  }
}

function getInitialTheme(): UiTheme {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'system'
}

function getInitialArchivedTimestampFormat(): ArchivedTimestampFormat {
  if (typeof window === 'undefined') {
    return 'relative'
  }

  const stored = window.localStorage.getItem(ARCHIVED_TIMESTAMP_FORMAT_STORAGE_KEY)
  if (stored === 'relative' || stored === 'full') {
    return stored
  }

  return 'relative'
}

function getInitialAutoCenterFocusedPanel(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  const stored = window.localStorage.getItem(AUTO_CENTER_FOCUSED_PANEL_STORAGE_KEY)
  if (stored === 'true') {
    return true
  }

  if (stored === 'false') {
    return false
  }

  return true
}

function getInitialCanvasZoom(): number {
  if (typeof window === 'undefined') {
    return 1
  }

  const stored = Number(window.localStorage.getItem(CANVAS_ZOOM_STORAGE_KEY))
  return clampCanvasZoom(stored)
}

function getInitialCanvasInteractionMode(): CanvasInteractionMode {
  if (typeof window === 'undefined') {
    return 'structured'
  }

  const stored = window.localStorage.getItem(CANVAS_INTERACTION_MODE_STORAGE_KEY)
  if (stored === 'structured' || stored === 'free') {
    return stored
  }

  return 'structured'
}

function getInitialRuntimePowerMode(): RuntimePowerMode {
  if (typeof window === 'undefined') {
    return 'mid'
  }

  const stored = window.localStorage.getItem(RUNTIME_POWER_MODE_STORAGE_KEY)
  if (stored === 'low' || stored === 'mid' || stored === 'high') {
    return stored
  }

  return 'mid'
}

function getInitialFollowUpBehavior(): FollowUpBehavior {
  if (typeof window === 'undefined') {
    return 'steer'
  }

  const stored = window.localStorage.getItem(FOLLOW_UP_BEHAVIOR_STORAGE_KEY)
  if (stored === 'queue' || stored === 'steer') {
    return stored
  }

  return 'steer'
}

interface UiState {
  activeProjectId: string | null
  sidebarCollapsed: boolean
  showNewProjectModal: boolean
  showProjectPage: boolean
  projectPageOpenById: Record<string, boolean>
  showSettingsPage: boolean
  theme: UiTheme
  archivedTimestampFormat: ArchivedTimestampFormat
  autoCenterFocusedPanel: boolean
  canvasInteractionMode: CanvasInteractionMode
  runtimePowerMode: RuntimePowerMode
  followUpBehavior: FollowUpBehavior
  canvasZoom: number

  setActiveProject: (id: string | null) => void
  toggleSidebar: () => void
  setShowNewProjectModal: (show: boolean) => void
  toggleProjectPage: () => void
  setShowProjectPage: (show: boolean) => void
  setShowSettingsPage: (show: boolean) => void
  setTheme: (theme: UiTheme) => void
  setArchivedTimestampFormat: (format: ArchivedTimestampFormat) => void
  setAutoCenterFocusedPanel: (enabled: boolean) => void
  setCanvasInteractionMode: (mode: CanvasInteractionMode) => void
  setRuntimePowerMode: (mode: RuntimePowerMode) => void
  setFollowUpBehavior: (behavior: FollowUpBehavior) => void
  setCanvasZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activeProjectId: null,
  sidebarCollapsed: false,
  showNewProjectModal: false,
  showProjectPage: false,
  projectPageOpenById: {},
  showSettingsPage: false,
  theme: getInitialTheme(),
  archivedTimestampFormat: getInitialArchivedTimestampFormat(),
  autoCenterFocusedPanel: getInitialAutoCenterFocusedPanel(),
  canvasInteractionMode: getInitialCanvasInteractionMode(),
  runtimePowerMode: getInitialRuntimePowerMode(),
  followUpBehavior: getInitialFollowUpBehavior(),
  canvasZoom: getInitialCanvasZoom(),

  setActiveProject: (id) =>
    set((state) => ({
      activeProjectId: id,
      showProjectPage: id ? Boolean(state.projectPageOpenById[id]) : false,
      showSettingsPage: false
    })),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
  toggleProjectPage: () =>
    set((state) => {
      if (!state.activeProjectId) {
        return { showSettingsPage: false }
      }

      const nextShowProjectPage = !state.showProjectPage

      return {
        showProjectPage: nextShowProjectPage,
        projectPageOpenById: {
          ...state.projectPageOpenById,
          [state.activeProjectId]: nextShowProjectPage
        },
        showSettingsPage: false
      }
    }),
  setShowProjectPage: (show) =>
    set((state) => {
      if (!state.activeProjectId) {
        return { showProjectPage: show, showSettingsPage: false }
      }

      return {
        showProjectPage: show,
        projectPageOpenById: {
          ...state.projectPageOpenById,
          [state.activeProjectId]: show
        },
        showSettingsPage: false
      }
    }),
  setShowSettingsPage: (show) => set({ showSettingsPage: show, showProjectPage: false }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
    set({ theme })
  },
  setArchivedTimestampFormat: (archivedTimestampFormat) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        ARCHIVED_TIMESTAMP_FORMAT_STORAGE_KEY,
        archivedTimestampFormat
      )
    }
    set({ archivedTimestampFormat })
  },
  setAutoCenterFocusedPanel: (autoCenterFocusedPanel) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        AUTO_CENTER_FOCUSED_PANEL_STORAGE_KEY,
        String(autoCenterFocusedPanel)
      )
    }
    set({ autoCenterFocusedPanel })
  },
  setCanvasInteractionMode: (canvasInteractionMode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        CANVAS_INTERACTION_MODE_STORAGE_KEY,
        canvasInteractionMode
      )
    }

    set({
      canvasInteractionMode,
      canvasZoom: canvasInteractionMode === 'structured' ? 1 : getInitialCanvasZoom()
    })
  },
  setRuntimePowerMode: (runtimePowerMode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        RUNTIME_POWER_MODE_STORAGE_KEY,
        runtimePowerMode
      )
    }

    set({ runtimePowerMode })
  },
  setFollowUpBehavior: (followUpBehavior) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FOLLOW_UP_BEHAVIOR_STORAGE_KEY, followUpBehavior)
    }

    set({ followUpBehavior })
  },
  setCanvasZoom: (canvasZoom) => {
    const nextZoom = clampCanvasZoom(canvasZoom)
    persistCanvasZoom(nextZoom)
    set({ canvasZoom: nextZoom })
  },
  zoomIn: () =>
    set((state) => {
      const nextZoom =
        CANVAS_ZOOM_STEPS.find((step) => step > state.canvasZoom + 0.001) ?? MAX_CANVAS_ZOOM
      persistCanvasZoom(nextZoom)
      return { canvasZoom: nextZoom }
    }),
  zoomOut: () =>
    set((state) => {
      const nextZoom =
        [...CANVAS_ZOOM_STEPS].reverse().find((step) => step < state.canvasZoom - 0.001) ??
        MIN_CANVAS_ZOOM
      persistCanvasZoom(nextZoom)
      return { canvasZoom: nextZoom }
    }),
  resetZoom: () => {
    persistCanvasZoom(1)
    set({ canvasZoom: 1 })
  }
}))
