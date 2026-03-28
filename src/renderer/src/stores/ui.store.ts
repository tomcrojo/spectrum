import { create } from 'zustand'

interface UiState {
  activeProjectId: string | null
  sidebarCollapsed: boolean
  showNewProjectModal: boolean
  showProjectPage: boolean

  setActiveProject: (id: string | null) => void
  toggleSidebar: () => void
  setShowNewProjectModal: (show: boolean) => void
  toggleProjectPage: () => void
  setShowProjectPage: (show: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeProjectId: null,
  sidebarCollapsed: false,
  showNewProjectModal: false,
  showProjectPage: false,

  setActiveProject: (id) => set({ activeProjectId: id, showProjectPage: false }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setShowNewProjectModal: (show) => set({ showNewProjectModal: show }),
  toggleProjectPage: () =>
    set((state) => ({ showProjectPage: !state.showProjectPage })),
  setShowProjectPage: (show) => set({ showProjectPage: show })
}))
