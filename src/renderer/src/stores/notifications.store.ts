import { create } from 'zustand'
import type { ThreadNotificationKind } from '@renderer/stores/panel-runtime.store'

export interface ThreadNotification {
  id: string
  panelId: string
  workspaceId: string
  panelTitle: string
  kind: ThreadNotificationKind
  createdAt: number
}

interface NotificationsState {
  toasts: ThreadNotification[]
  addToast: (toast: Omit<ThreadNotification, 'id' | 'createdAt'>) => void
  dismissToast: (id: string) => void
  dismissAllToasts: () => void
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `${toast.panelId}-${Date.now()}`
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id,
          createdAt: Date.now()
        }
      ]
    }))
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  },

  dismissAllToasts: () => {
    set({ toasts: [] })
  }
}))
