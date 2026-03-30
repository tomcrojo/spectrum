import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { FILE_CHANNELS } from '@shared/ipc-channels'
import type {
  FileTreeNode,
  OpenFileInPanelInput,
  OpenFileInPanelResult,
  ReadFileInput,
  ReadFileResult,
  StatFileInput,
  StatFileResult,
  WriteFileInput,
  WriteFileResult
} from '@shared/file.types'
import { getProject } from '../db/projects.repo'
import { getDb } from '../db/database'

const IGNORED_NAMES = new Set(['.git', 'node_modules', 'dist', 'out', '.DS_Store'])
const MAX_TEXT_FILE_BYTES = 1024 * 1024

type FileIpcErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'WORKSPACE_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'OUTSIDE_PROJECT_ROOT'
  | 'UNSUPPORTED_BINARY_FILE'
  | 'FILE_TOO_LARGE'
  | 'STALE_WRITE_CONFLICT'
  | 'INVALID_FILE_TARGET'

function createFileIpcError(code: FileIpcErrorCode, message: string): Error {
  const error = new Error(message) as Error & { code?: FileIpcErrorCode }
  error.name = 'CentipedeFileError'
  error.code = code
  return error
}

function isInsideRoot(rootPath: string, targetPath: string): boolean {
  const nextRelativePath = relative(rootPath, targetPath)
  return (
    nextRelativePath === '' ||
    (!nextRelativePath.startsWith('..') && !isAbsolute(nextRelativePath))
  )
}

function clampCursorValue(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.floor(value as number))
}

async function getProjectRoot(projectId: string): Promise<string> {
  const project = getProject(projectId)
  if (!project) {
    throw createFileIpcError('PROJECT_NOT_FOUND', 'Project not found.')
  }

  const resolvedRoot = resolve(project.repoPath)
  const realRoot = await fs.realpath(resolvedRoot)
  return resolve(realRoot)
}

function assertWorkspaceBelongsToProject(projectId: string, workspaceId: string): void {
  const row = getDb()
    .prepare('SELECT id, project_id FROM workspaces WHERE id = ?')
    .get(workspaceId) as { id: string; project_id: string } | undefined

  if (!row || row.project_id !== projectId) {
    throw createFileIpcError('WORKSPACE_NOT_FOUND', 'Workspace not found for project.')
  }
}

function resolveInputPath(projectRoot: string, inputPath: string): string {
  const normalizedPath = resolve(inputPath)
  if (!isInsideRoot(projectRoot, normalizedPath)) {
    throw createFileIpcError(
      'OUTSIDE_PROJECT_ROOT',
      'The requested path is outside the project root.'
    )
  }

  return normalizedPath
}

async function resolveExistingPathInsideRoot(
  projectRoot: string,
  inputPath: string
): Promise<{ normalizedPath: string; realPath: string }> {
  const normalizedPath = resolveInputPath(projectRoot, inputPath)

  let realPath: string
  try {
    realPath = await fs.realpath(normalizedPath)
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw createFileIpcError('FILE_NOT_FOUND', 'File not found.')
    }
    throw error
  }

  const resolvedRealPath = resolve(realPath)
  if (!isInsideRoot(projectRoot, resolvedRealPath)) {
    throw createFileIpcError(
      'OUTSIDE_PROJECT_ROOT',
      'The requested path resolves outside the project root.'
    )
  }

  return { normalizedPath, realPath: resolvedRealPath }
}

async function readTreeNode(projectRoot: string, targetPath: string): Promise<FileTreeNode> {
  const dirEntries = await fs.readdir(targetPath, { withFileTypes: true })
  const visibleEntries = dirEntries
    .filter((entry) => !IGNORED_NAMES.has(entry.name))
    .filter((entry) => !entry.isSymbolicLink())
    .toSorted((left, right) => {
      const leftRank = left.isDirectory() ? 0 : 1
      const rightRank = right.isDirectory() ? 0 : 1
      if (leftRank !== rightRank) {
        return leftRank - rightRank
      }

      return left.name.localeCompare(right.name)
    })

  const children = await Promise.all(
    visibleEntries.map(async (entry) => {
      const absolutePath = join(targetPath, entry.name)
      const relativePath = relative(projectRoot, absolutePath)

      if (entry.isDirectory()) {
        return readTreeNode(projectRoot, absolutePath)
      }

      return {
        name: entry.name,
        path: absolutePath,
        relativePath,
        kind: 'file'
      } satisfies FileTreeNode
    })
  )

  return {
    name: basename(targetPath),
    path: targetPath,
    relativePath: relative(projectRoot, targetPath),
    kind: 'directory',
    children
  }
}

async function listTree(projectId: string): Promise<FileTreeNode> {
  const projectRoot = await getProjectRoot(projectId)
  return readTreeNode(projectRoot, projectRoot)
}

async function readFileContents(input: ReadFileInput): Promise<ReadFileResult> {
  const projectRoot = await getProjectRoot(input.projectId)
  const { realPath } = await resolveExistingPathInsideRoot(projectRoot, input.path)
  const fileStat = await fs.stat(realPath)

  if (!fileStat.isFile()) {
    throw createFileIpcError('INVALID_FILE_TARGET', 'The requested path is not a file.')
  }

  if (fileStat.size > MAX_TEXT_FILE_BYTES) {
    throw createFileIpcError('FILE_TOO_LARGE', 'File is larger than the 1 MB editor limit.')
  }

  const buffer = await fs.readFile(realPath)
  if (buffer.includes(0)) {
    throw createFileIpcError(
      'UNSUPPORTED_BINARY_FILE',
      'Binary files are not supported in the in-app editor.'
    )
  }

  return {
    path: realPath,
    relativePath: relative(projectRoot, realPath),
    content: buffer.toString('utf8'),
    language: null,
    mtimeMs: fileStat.mtimeMs
  }
}

async function writeFileContents(input: WriteFileInput): Promise<WriteFileResult> {
  const projectRoot = await getProjectRoot(input.projectId)
  const normalizedPath = resolveInputPath(projectRoot, input.path)

  let parentRealPath: string
  try {
    parentRealPath = resolve(await fs.realpath(dirname(normalizedPath)))
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw createFileIpcError('FILE_NOT_FOUND', 'File not found.')
    }
    throw error
  }

  if (!isInsideRoot(projectRoot, parentRealPath)) {
    throw createFileIpcError(
      'OUTSIDE_PROJECT_ROOT',
      'The requested path resolves outside the project root.'
    )
  }

  const { realPath } = await resolveExistingPathInsideRoot(projectRoot, normalizedPath)
  const currentStat = await fs.stat(realPath)

  if (!currentStat.isFile()) {
    throw createFileIpcError('INVALID_FILE_TARGET', 'The requested path is not a file.')
  }

  if (currentStat.mtimeMs !== input.expectedMtimeMs) {
    throw createFileIpcError(
      'STALE_WRITE_CONFLICT',
      'The file changed on disk. Reload it before saving.'
    )
  }

  await fs.writeFile(realPath, input.content, 'utf8')
  const nextStat = await fs.stat(realPath)

  return {
    path: realPath,
    mtimeMs: nextStat.mtimeMs
  }
}

async function statFile(input: StatFileInput): Promise<StatFileResult> {
  const projectRoot = await getProjectRoot(input.projectId)
  const normalizedPath = resolveInputPath(projectRoot, input.path)

  try {
    const { realPath } = await resolveExistingPathInsideRoot(projectRoot, normalizedPath)
    const targetStat = await fs.stat(realPath)

    return {
      path: realPath,
      exists: true,
      kind: targetStat.isDirectory() ? 'directory' : targetStat.isFile() ? 'file' : null,
      mtimeMs: targetStat.mtimeMs
    }
  } catch (error: any) {
    if (error?.code === 'FILE_NOT_FOUND' || error?.code === 'ENOENT') {
      return {
        path: normalizedPath,
        exists: false,
        kind: null,
        mtimeMs: null
      }
    }

    throw error
  }
}

async function normalizeOpenRequest(
  input: OpenFileInPanelInput
): Promise<OpenFileInPanelResult> {
  const projectRoot = await getProjectRoot(input.projectId)
  assertWorkspaceBelongsToProject(input.projectId, input.workspaceId)
  const { realPath } = await resolveExistingPathInsideRoot(projectRoot, input.path)
  const targetStat = await fs.stat(realPath)

  if (!targetStat.isFile()) {
    throw createFileIpcError('INVALID_FILE_TARGET', 'The requested path is not a file.')
  }

  return {
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    path: realPath,
    relativePath: relative(projectRoot, realPath),
    line: clampCursorValue(input.line),
    column: clampCursorValue(input.column),
    source: input.source
  }
}

export function registerFileHandlers(): void {
  ipcMain.handle(FILE_CHANNELS.LIST_TREE, (_event, projectId: string) => listTree(projectId))
  ipcMain.handle(FILE_CHANNELS.READ, (_event, input: ReadFileInput) => readFileContents(input))
  ipcMain.handle(FILE_CHANNELS.WRITE, (_event, input: WriteFileInput) => writeFileContents(input))
  ipcMain.handle(FILE_CHANNELS.STAT, (_event, input: StatFileInput) => statFile(input))
  ipcMain.handle(FILE_CHANNELS.OPEN_IN_PANEL, (_event, input: OpenFileInPanelInput) =>
    normalizeOpenRequest(input)
  )
}
