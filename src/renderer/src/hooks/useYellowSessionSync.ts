import { useEffect } from 'react'
import { browserApi } from '@renderer/lib/ipc'
import { useUiStore } from '@renderer/stores/ui.store'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

export function useYellowSessionSync(): void {
  const activeProjectId = useUiStore((state) => state.activeProjectId)
  const activePanels = useWorkspacesStore((state) => state.activePanels)
  const focusedPanelId = useWorkspacesStore((state) => state.focusedPanelId)

  useEffect(() => {
    const focusedPanel = focusedPanelId
      ? activePanels.find((panel) => panel.panelId === focusedPanelId)
      : null
    const activeWorkspaceId =
      focusedPanel?.workspaceId ?? activePanels.at(-1)?.workspaceId ?? null

    const focusedBrowserPanelId =
      focusedPanel?.panelType === 'browser' ? focusedPanel.panelId : null

    browserApi
      .sessionSync({
        activeProjectId,
        activeWorkspaceId,
        focusedBrowserPanelId
      })
      .catch(() => {})
  }, [activePanels, activeProjectId, focusedPanelId])
}
