import { create } from 'zustand'
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Task,
  CreateTaskInput
} from '@shared/project.types'
import { projectsApi, tasksApi } from '@renderer/lib/ipc'

interface ProjectsState {
  projects: Project[]
  tasks: Task[] // tasks for the active project
  loading: boolean

  loadProjects: () => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (input: UpdateProjectInput) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  loadTasks: (projectId: string) => Promise<void>
  createTask: (input: CreateTaskInput) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  tasks: [],
  loading: false,

  loadProjects: async () => {
    set({ loading: true })
    const projects = await projectsApi.list()
    set({ projects, loading: false })
  },

  createProject: async (input) => {
    const project = await projectsApi.create(input)
    set((state) => ({ projects: [project, ...state.projects] }))
    return project
  },

  updateProject: async (input) => {
    const updated = await projectsApi.update(input)
    if (updated) {
      set((state) => ({
        projects: state.projects.map((p) => (p.id === updated.id ? updated : p))
      }))
    }
  },

  deleteProject: async (id) => {
    await projectsApi.delete(id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id)
    }))
  },

  loadTasks: async (projectId) => {
    const tasks = await tasksApi.list(projectId)
    set({ tasks })
  },

  createTask: async (input) => {
    const task = await tasksApi.create(input)
    set((state) => ({ tasks: [...state.tasks, task] }))
  },

  toggleTask: async (id) => {
    const updated = await tasksApi.toggle(id)
    if (updated) {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === updated.id ? updated : t))
      }))
    }
  },

  deleteTask: async (id) => {
    await tasksApi.delete(id)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id)
    }))
  }
}))
