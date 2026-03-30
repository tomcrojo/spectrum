import { CdpProxy } from './CdpProxy'

interface WorkspaceProxyState {
  proxy: CdpProxy
  port: number
}

const workspaceProxies = new Map<string, WorkspaceProxyState>()
const targetWorkspaceById = new Map<string, string>()
const panelIdByTargetId = new Map<string, string>()
let automationStateListener:
  | ((payload: { workspaceId: string; panelId: string; automationAttached: boolean }) => void)
  | null = null

function targetIdFromWebContentsId(webContentsId: number): string {
  return String(webContentsId)
}

export function setCdpAutomationStateListener(
  listener: ((payload: { workspaceId: string; panelId: string; automationAttached: boolean }) => void) | null
): void {
  automationStateListener = listener
}

export async function registerCdpTarget(input: {
  workspaceId: string
  webContentsId: number
  panelId: string
  title?: string
  url?: string
}): Promise<number> {
  let state = workspaceProxies.get(input.workspaceId)
  if (!state) {
    const proxy = new CdpProxy(input.workspaceId, (targetId, automationAttached) => {
      const workspaceId = targetWorkspaceById.get(targetId)
      const panelId = panelIdByTargetId.get(targetId)
      if (!workspaceId || !panelId || !automationStateListener) {
        return
      }

      automationStateListener({
        workspaceId,
        panelId,
        automationAttached
      })
    })
    const port = await proxy.start()
    state = { proxy, port }
    workspaceProxies.set(input.workspaceId, state)
  }

  const targetId = targetIdFromWebContentsId(input.webContentsId)
  targetWorkspaceById.set(targetId, input.workspaceId)
  panelIdByTargetId.set(targetId, input.panelId)

  state.proxy.registerTarget({
    id: targetId,
    webContentsId: input.webContentsId,
    title: input.title ?? `Browser ${input.panelId}`,
    url: input.url ?? 'about:blank'
  })

  return state.port
}

export function updateCdpTarget(input: {
  webContentsId: number
  title?: string
  url?: string
}): void {
  const targetId = targetIdFromWebContentsId(input.webContentsId)
  const workspaceId = targetWorkspaceById.get(targetId)
  if (!workspaceId) {
    return
  }

  const state = workspaceProxies.get(workspaceId)
  if (!state) {
    return
  }

  state.proxy.updateTarget(targetId, {
    title: input.title,
    url: input.url
  })
}

export async function unregisterCdpTarget(input: {
  workspaceId: string
  webContentsId: number
}): Promise<void> {
  const state = workspaceProxies.get(input.workspaceId)
  if (!state) {
    return
  }

  const targetId = targetIdFromWebContentsId(input.webContentsId)
  targetWorkspaceById.delete(targetId)
  panelIdByTargetId.delete(targetId)
  state.proxy.unregisterTarget(targetId)

  if (state.proxy.listTargets().length > 0) {
    return
  }

  await state.proxy.shutdown()
  workspaceProxies.delete(input.workspaceId)
}

export function getCdpProxyPort(workspaceId: string): number | null {
  return workspaceProxies.get(workspaceId)?.port ?? null
}

export function hasAttachedAutomationClients(workspaceId: string, webContentsId: number): boolean {
  const state = workspaceProxies.get(workspaceId)
  if (!state) {
    return false
  }

  return state.proxy.hasAttachedClients(targetIdFromWebContentsId(webContentsId))
}

export async function shutdownCdpProxies(): Promise<void> {
  for (const [, state] of workspaceProxies) {
    await state.proxy.shutdown()
  }
  workspaceProxies.clear()
  targetWorkspaceById.clear()
  panelIdByTargetId.clear()
}
