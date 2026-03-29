import { create } from 'zustand'

export type UiTheme = 'light' | 'dark' | 'system'
export type ArchivedTimestampFormat = 'relative' | 'full'

const THEME_STORAGE_KEY = 'centipede:theme'
const ARCHIVED_TIMESTAMP_FORMAT_STORAGE_KEY = 'centipede:archived-timestamp-format'

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

interface UiState {
  activeProjectId: string | null
  sidebarCollapsed: boolean
  showNewProjectModal: boolean
  showProjectPage: boolean
  showSettingsPage: boolean
  theme: UiTheme
  archivedTimestampFormat: ArchivedTimestampFormat

  setActiveProject: (id: string | null) => void
  toggleSidebar: () => void
  setShowNewProjectModal: (show: boolean) => void
  toggleProjectPage: () => void
  setShowProjectPage: (show: boolean) => void
  setShowSettingsPage: (show: boolean) => void
  setTheme: (theme: UiTheme) => void
  setArchivedTimestampFormat: (format: ArchivedTimestampFormat) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeProjectId: null,
  sidebarCollapsed: false,
  showNewProjectModal: false,
  showProjectPage: false,
  showSettingsPage: false,
  theme: getInitialTheme(),
  archivedTimestampFormat: getInitialArchivedTimestampFormat(),

  setActiveProject: (id) =>
    set({ activeProjectId: id, showProjectPage: false, showSettingsPage: false }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
  toggleProjectPage: () =>
    set((state) => ({
      showProjectPage: !state.showProjectPage,
      showSettingsPage: false
    })),
  setShowProjectPage: (show) => set({ showProjectPage: show, showSettingsPage: false }),
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
  }
}))
