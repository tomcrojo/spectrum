import type { OpenFileInPanelInput } from '@shared/file.types'
import { filesApi } from './ipc'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

export async function openFileInWorkspace(input: OpenFileInPanelInput): Promise<string> {
  const normalized = await filesApi.openInPanel(input)
  return useWorkspacesStore.getState().openFilePanel(normalized)
}
