import { create } from 'zustand'
import type { Workspace, CreateWorkspaceInput } from '@shared/workspace.types'
import { workspacesApi } from '@renderer/lib/ipc'

interface WorkspacesState {
  workspaces: Workspace[]

  loadWorkspaces: (projectId: string) => Promise<void>
  createWorkspace: (input: CreateWorkspaceInput) => Promise<void>
  archiveWorkspace: (id: string) => Promise<void>
}

export const useWorkspacesStore = create<WorkspacesState>((set) => ({
  workspaces: [],

  loadWorkspaces: async (projectId) => {
    const workspaces = await workspacesApi.list(projectId)
    set({ workspaces })
  },

  createWorkspace: async (input) => {
    const workspace = await workspacesApi.create(input)
    set((state) => ({ workspaces: [...state.workspaces, workspace] }))
  },

  archiveWorkspace: async (id) => {
    await workspacesApi.archive(id)
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== id)
    }))
  }
}))
