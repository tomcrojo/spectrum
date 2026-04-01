import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { getBrowserCliThreadBindingsFilePath } from './BrowserCliPathManager'

export interface BrowserCliThreadBindingRecord {
  threadId: string
  projectId: string
  workspaceId: string
  browserApiBaseUrl: string
  browserApiToken: string
  updatedAt: string
}

export function readBrowserCliThreadBindings(): BrowserCliThreadBindingRecord[] {
  const filePath = getBrowserCliThreadBindingsFilePath()

  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as BrowserCliThreadBindingRecord[]) : []
  } catch {
    return []
  }
}

export function writeBrowserCliThreadBindings(records: BrowserCliThreadBindingRecord[]): void {
  const filePath = getBrowserCliThreadBindingsFilePath()

  if (records.length === 0) {
    rmSync(filePath, { force: true })
    return
  }

  const directory = dirname(filePath)
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`

  mkdirSync(directory, { recursive: true })
  writeFileSync(tempPath, JSON.stringify(records, null, 2))

  try {
    renameSync(tempPath, filePath)
  } catch (error) {
    rmSync(tempPath, { force: true })
    throw error
  }
}

export function upsertBrowserCliThreadBindingRecord(
  record: BrowserCliThreadBindingRecord
): void {
  const records = readBrowserCliThreadBindings().filter((entry) => entry.threadId !== record.threadId)
  records.push(record)
  writeBrowserCliThreadBindings(records)
}
