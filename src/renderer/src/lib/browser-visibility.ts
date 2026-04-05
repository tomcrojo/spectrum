import type { ActiveWorkspacePanel } from '@renderer/stores/workspaces.store'
import type { RuntimePowerMode } from '@renderer/stores/ui.store'
import type { Workspace } from '@shared/workspace.types'

interface VisibleBrowserWorkspaceIdsInput {
  browserPanels: ActiveWorkspacePanel[]
  workspaces: Workspace[]
  runtimePowerMode: RuntimePowerMode
  activeWorkspaceId: string | null
}

const MID_POWER_VISIBLE_WORKSPACE_COUNT = 3

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN
  }

  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function getWorkspaceRecency(workspace: Workspace | undefined): number {
  return Math.max(
    parseTimestamp(workspace?.lastPanelEditedAt),
    parseTimestamp(workspace?.updatedAt),
    parseTimestamp(workspace?.createdAt)
  )
}

export function getVisibleBrowserWorkspaceIds({
  browserPanels,
  workspaces,
  runtimePowerMode,
  activeWorkspaceId
}: VisibleBrowserWorkspaceIdsInput): Set<string> {
  const workspaceIds = Array.from(new Set(browserPanels.map((panel) => panel.workspaceId)))

  if (runtimePowerMode === 'high') {
    return new Set(workspaceIds)
  }

  if (runtimePowerMode === 'low') {
    return new Set(activeWorkspaceId ? [activeWorkspaceId] : [])
  }

  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]))
  const panelIndexByWorkspaceId = new Map<string, number>()

  browserPanels.forEach((panel, index) => {
    if (!panelIndexByWorkspaceId.has(panel.workspaceId)) {
      panelIndexByWorkspaceId.set(panel.workspaceId, index)
    }
  })

  const rankedWorkspaceIds = [...workspaceIds]
    .filter((workspaceId) => workspaceId !== activeWorkspaceId)
    .sort((left, right) => {
      const leftRecency = getWorkspaceRecency(workspaceById.get(left))
      const rightRecency = getWorkspaceRecency(workspaceById.get(right))

      if (leftRecency !== rightRecency) {
        return rightRecency - leftRecency
      }

      return (panelIndexByWorkspaceId.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (panelIndexByWorkspaceId.get(right) ?? Number.MAX_SAFE_INTEGER)
    })

  const visibleWorkspaceIds = activeWorkspaceId ? [activeWorkspaceId] : []
  for (const workspaceId of rankedWorkspaceIds) {
    if (visibleWorkspaceIds.length >= MID_POWER_VISIBLE_WORKSPACE_COUNT) {
      break
    }

    visibleWorkspaceIds.push(workspaceId)
  }

  return new Set(visibleWorkspaceIds)
}
