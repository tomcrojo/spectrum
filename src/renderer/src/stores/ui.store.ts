import { create } from 'zustand'

interface UiState {
  activeProjectId: string | null
  sidebarCollapsed: boolean
  showNewProjectModal: boolean

  setActiveProject: (id: string | null) => void
  toggleSidebar: () => void
  setShowNewProjectModal: (show: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeProjectId: null,
  sidebarCollapsed: false,
  showNewProjectModal: false,

  setActiveProject: (id) => set({ activeProjectId: id }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setShowNewProjectModal: (show) => set({ showNewProjectModal: show })
}))
