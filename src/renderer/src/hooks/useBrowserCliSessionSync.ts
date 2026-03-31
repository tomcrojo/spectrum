import { useEffect } from 'react'
import { browserApi } from '@renderer/lib/ipc'
import { useUiStore } from '@renderer/stores/ui.store'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

export function useBrowserCliSessionSync(): void {
  const activeProjectId = useUiStore((state) => state.activeProjectId)
  const focusedPanelId = useWorkspacesStore((state) => state.focusedPanelId)
  const focusedBrowserPanelId = useWorkspacesStore((state) => state.focusedBrowserPanelId)
  const activeWorkspaceId = usePanelRuntimeStore((state) => state.activeWorkspaceId)

  useEffect(() => {
    browserApi
      .sessionSync({
        activeProjectId,
        activeWorkspaceId,
        focusedBrowserPanelId,
        userFocusedPanelId: focusedPanelId
      })
      .catch(() => {})
  }, [activeProjectId, activeWorkspaceId, focusedBrowserPanelId, focusedPanelId])
}
