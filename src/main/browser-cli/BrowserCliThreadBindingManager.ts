import { randomUUID } from 'node:crypto'
import { getApiPort } from '../api/BrowserApiServer'
import { registerToken, revokeToken } from '../api/TokenRegistry'
import {
  readBrowserCliThreadBindings,
  upsertBrowserCliThreadBindingRecord,
  writeBrowserCliThreadBindings
} from './BrowserCliThreadBindingStore'

export function upsertBrowserCliThreadBinding(input: {
  threadId: string
  workspaceId: string
  projectId: string
}): void {
  const existing = readBrowserCliThreadBindings().find((entry) => entry.threadId === input.threadId)
  const shouldReuseToken =
    existing?.workspaceId === input.workspaceId && existing.projectId === input.projectId

  if (existing && !shouldReuseToken) {
    revokeToken(existing.browserApiToken)
  }

  const browserApiToken = shouldReuseToken
    ? existing.browserApiToken
    : randomUUID().replace(/-/g, '')

  registerToken(browserApiToken, input.workspaceId, input.projectId)

  upsertBrowserCliThreadBindingRecord({
    threadId: input.threadId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    browserApiBaseUrl: `http://127.0.0.1:${getApiPort()}`,
    browserApiToken,
    updatedAt: new Date().toISOString()
  })
}

export function clearBrowserCliThreadBindings(): void {
  const records = readBrowserCliThreadBindings()

  for (const record of records) {
    revokeToken(record.browserApiToken)
  }

  writeBrowserCliThreadBindings([])
}
