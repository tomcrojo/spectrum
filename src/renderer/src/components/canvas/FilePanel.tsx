import { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileTreeNode, ReadFileResult } from '@shared/file.types'
import { Button } from '@renderer/components/shared/Button'
import { Modal } from '@renderer/components/shared/Modal'
import { cn } from '@renderer/lib/cn'
import { filesApi } from '@renderer/lib/ipc'
import { configureMonacoEnvironment } from '@renderer/lib/monaco-environment'
import { ensureCentipedeMonacoTheme } from '@renderer/lib/monaco-theme'
import { useResolvedTheme } from '@renderer/lib/theme'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

interface FilePanelProps {
  panelId: string
  workspaceId: string
  projectId: string
  projectPath: string
  initialFilePath?: string
  initialCursorLine?: number
  initialCursorColumn?: number
  autoFocus: boolean
}

interface ActiveFileState {
  path: string
  relativePath: string
  content: string
  lastSavedContent: string
  language: string
  mtimeMs: number
}

interface FileLoadErrorState {
  title: string
  description: string
}

interface CloseDialogState {
  isSaving: boolean
  resolve: (shouldClose: boolean) => void
}

interface EditorCrashBoundaryProps {
  children: React.ReactNode
  onError: (error: Error) => void
}

interface EditorCrashBoundaryState {
  hasError: boolean
}

class EditorCrashBoundary extends Component<
  EditorCrashBoundaryProps,
  EditorCrashBoundaryState
> {
  state: EditorCrashBoundaryState = { hasError: false }

  static getDerivedStateFromError(): EditorCrashBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error)
  }

  componentDidUpdate(prevProps: EditorCrashBoundaryProps): void {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return null
    }

    return this.props.children
  }
}

const treeCache = new Map<string, Promise<FileTreeNode>>()
const MonacoEditor = configureMonacoEnvironment()

function getTreeForProject(projectId: string): Promise<FileTreeNode> {
  const existing = treeCache.get(projectId)
  if (existing) {
    return existing
  }

  const nextTree = filesApi.listTree(projectId)
  treeCache.set(projectId, nextTree)
  return nextTree
}

function invalidateTree(projectId: string): void {
  treeCache.delete(projectId)
}

function getFileName(path: string): string {
  return path.split('/').at(-1)?.split('\\').at(-1) ?? path
}

function getRelativeDisplayPath(relativePath: string | null): string {
  return relativePath && relativePath.trim() ? relativePath : 'Select a file from the tree'
}

function extractErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return undefined
}

function getLoadErrorState(error: unknown): FileLoadErrorState {
  const code = extractErrorCode(error)

  if (code === 'UNSUPPORTED_BINARY_FILE') {
    return {
      title: 'Binary file',
      description: 'This file contains binary data and cannot be edited in the v1 file panel.'
    }
  }

  if (code === 'FILE_TOO_LARGE') {
    return {
      title: 'File too large',
      description: 'Files larger than 1 MB are blocked in the in-app editor.'
    }
  }

  if (code === 'FILE_NOT_FOUND') {
    return {
      title: 'File not found',
      description: 'The file no longer exists at the requested path.'
    }
  }

  return {
    title: 'Unable to open file',
    description: error instanceof Error ? error.message : 'An unknown error occurred.'
  }
}

function getLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').at(-1)?.toLowerCase() ?? ''
  const fileName = getFileName(filePath).toLowerCase()

  if (fileName === 'dockerfile') return 'dockerfile'
  if (fileName === 'makefile') return 'makefile'

  const languagesByExtension: Record<string, string> = {
    c: 'c',
    cc: 'cpp',
    cpp: 'cpp',
    css: 'css',
    go: 'go',
    h: 'cpp',
    html: 'html',
    java: 'java',
    js: 'javascript',
    json: 'json',
    jsx: 'javascript',
    md: 'markdown',
    mjs: 'javascript',
    py: 'python',
    rs: 'rust',
    sh: 'shell',
    sql: 'sql',
    svg: 'xml',
    ts: 'typescript',
    tsx: 'typescript',
    txt: 'plaintext',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml'
  }

  return languagesByExtension[extension] ?? 'plaintext'
}

function getMonacoModelPath(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')

  if (/^[A-Za-z]:\//.test(normalizedPath)) {
    return `file:///${normalizedPath}`
  }

  if (normalizedPath.startsWith('/')) {
    return `file://${normalizedPath}`
  }

  return `inmemory://centipede/${encodeURIComponent(normalizedPath)}`
}

function FileTreeItem({
  node,
  expandedPaths,
  selectedPath,
  onToggleDirectory,
  onSelectFile,
  depth = 0
}: {
  node: FileTreeNode
  expandedPaths: Set<string>
  selectedPath: string | null
  onToggleDirectory: (path: string) => void
  onSelectFile: (path: string) => void
  depth?: number
}) {
  const isDirectory = node.kind === 'directory'
  const isExpanded = isDirectory && expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path

  return (
    <div>
      <button
        type="button"
        onClick={() => (isDirectory ? onToggleDirectory(node.path) : onSelectFile(node.path))}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors',
          isSelected ? 'bg-bg-active text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-text-muted">
          {isDirectory ? (isExpanded ? '▾' : '▸') : '•'}
        </span>
        <span className="truncate">{node.name || '.'}</span>
      </button>

      {isDirectory && isExpanded && node.children?.length ? (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              onToggleDirectory={onToggleDirectory}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function FilePanel({
  panelId,
  workspaceId,
  projectId,
  projectPath,
  initialFilePath,
  initialCursorLine,
  initialCursorColumn,
  autoFocus
}: FilePanelProps) {
  const resolvedTheme = useResolvedTheme()
  const updatePanelLayout = useWorkspacesStore((state) => state.updatePanelLayout)
  const setPanelDirty = useWorkspacesStore((state) => state.setPanelDirty)
  const registerPanelCloseGuard = useWorkspacesStore((state) => state.registerPanelCloseGuard)
  const [tree, setTree] = useState<FileTreeNode | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [activeFile, setActiveFile] = useState<ActiveFileState | null>(null)
  const [selectedTreePath, setSelectedTreePath] = useState<string | null>(initialFilePath ?? null)
  const [currentContent, setCurrentContent] = useState('')
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<FileLoadErrorState | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [closeDialog, setCloseDialog] = useState<CloseDialogState | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const fallbackEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const cursorTimerRef = useRef<number | null>(null)
  const pendingSelectionRef = useRef<{ line: number; column: number } | null>(null)
  const activeFileRef = useRef<ActiveFileState | null>(null)
  const dirty = activeFile !== null && currentContent !== activeFile.lastSavedContent
  const selectedFilePath = activeFile?.path ?? selectedTreePath

  useEffect(() => {
    activeFileRef.current = activeFile
  }, [activeFile])

  useEffect(() => {
    getTreeForProject(projectId)
      .then((nextTree) => {
        setTree(nextTree)
        setTreeError(null)
        setExpandedPaths(new Set([nextTree.path]))
      })
      .catch((error) => {
        setTreeError(error instanceof Error ? error.message : 'Unable to load project files.')
      })
  }, [projectId])

  const applyCursorPosition = useCallback(() => {
    const editor = editorRef.current
    const target = pendingSelectionRef.current
    if (!editor || !target) {
      return
    }

    editor.setPosition(target)
    editor.revealPositionInCenter(target)
    pendingSelectionRef.current = null
  }, [])

  const applyLoadedFile = useCallback(
    (result: ReadFileResult, line?: number, column?: number) => {
      const nextFile: ActiveFileState = {
        path: result.path,
        relativePath: result.relativePath,
        content: result.content,
        lastSavedContent: result.content,
        language: getLanguageFromPath(result.path),
        mtimeMs: result.mtimeMs
      }

      setActiveFile(nextFile)
      setCurrentContent(result.content)
      setSelectedTreePath(result.path)
      setConflictMessage(null)
      setLoadError(null)
      setEditorError(null)
      setExpandedPaths((current) => {
        const next = new Set(current)
        const rootPath = tree?.path ?? projectPath
        const normalizedRoot = rootPath.replace(/\\/g, '/')
        const normalizedFilePath = result.path.replace(/\\/g, '/')
        const relativeToRoot = normalizedFilePath.startsWith(`${normalizedRoot}/`)
          ? normalizedFilePath.slice(normalizedRoot.length + 1)
          : result.relativePath.replace(/\\/g, '/')
        const directoryParts = relativeToRoot.split('/').slice(0, -1)

        let currentDirectoryPath = rootPath
        next.add(rootPath)
        for (const part of directoryParts) {
          currentDirectoryPath = `${currentDirectoryPath.replace(/[\\/]+$/, '')}/${part}`
          next.add(currentDirectoryPath)
        }

        return next
      })
      pendingSelectionRef.current = {
        line: Math.max(1, line ?? 1),
        column: Math.max(1, column ?? 1)
      }
      updatePanelLayout(panelId, {
        filePath: result.path,
        cursorLine: Math.max(1, line ?? 1),
        cursorColumn: Math.max(1, column ?? 1),
        panelTitle: getFileName(result.relativePath)
      })
    },
    [panelId, projectPath, tree?.path, updatePanelLayout]
  )

  const loadFile = useCallback(
    async (filePath: string, line?: number, column?: number) => {
      setIsLoadingFile(true)
      setSelectedTreePath(filePath)
      setConflictMessage(null)

      try {
        const result = await filesApi.read({ projectId, path: filePath })
        applyLoadedFile(result, line, column)
      } catch (error) {
        setLoadError(getLoadErrorState(error))
        setActiveFile(null)
        setCurrentContent('')
        updatePanelLayout(panelId, {
          filePath,
          cursorLine: Math.max(1, line ?? 1),
          cursorColumn: Math.max(1, column ?? 1),
          panelTitle: getFileName(filePath)
        })
      } finally {
        setIsLoadingFile(false)
      }
    },
    [applyLoadedFile, panelId, projectId, updatePanelLayout]
  )

  useEffect(() => {
    if (!initialFilePath) {
      return
    }

    void loadFile(
      initialFilePath,
      initialCursorLine ?? 1,
      initialCursorColumn ?? 1
    )
  }, [initialCursorColumn, initialCursorLine, initialFilePath, loadFile])

  useEffect(() => {
    setPanelDirty(panelId, dirty)
  }, [dirty, panelId, setPanelDirty])

  const saveFile = useCallback(async () => {
    const currentFile = activeFileRef.current
    if (!currentFile) {
      return false
    }

    setIsSaving(true)
    setConflictMessage(null)

    try {
      const result = await filesApi.write({
        projectId,
        path: currentFile.path,
        content: currentContent,
        expectedMtimeMs: currentFile.mtimeMs
      })

      setActiveFile({
        ...currentFile,
        content: currentContent,
        lastSavedContent: currentContent,
        mtimeMs: result.mtimeMs
      })
      return true
    } catch (error) {
      if (extractErrorCode(error) === 'STALE_WRITE_CONFLICT') {
        setConflictMessage('The file changed on disk after it was loaded. Reload before saving.')
        return false
      }

      setConflictMessage(error instanceof Error ? error.message : 'Unable to save the file.')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [currentContent, projectId])

  const reloadFile = useCallback(async () => {
    if (!activeFileRef.current) {
      return
    }

    if (dirty && !window.confirm('Discard unsaved changes and reload from disk?')) {
      return
    }

    await loadFile(
      activeFileRef.current.path,
      useWorkspacesStore.getState().activePanels.find((panel) => panel.panelId === panelId)?.cursorLine ?? 1,
      useWorkspacesStore.getState().activePanels.find((panel) => panel.panelId === panelId)?.cursorColumn ?? 1
    )
  }, [dirty, loadFile, panelId])

  const teardownEditorBeforeFileSwitch = useCallback(async () => {
    editorRef.current = null
    monacoRef.current = null
    setEditorError(null)
    setActiveFile(null)
    setCurrentContent('')

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }, [])

  useEffect(() => {
    registerPanelCloseGuard(panelId, async () => {
      if (!dirty) {
        return true
      }

      return new Promise<boolean>((resolve) => {
        setCloseDialog({ isSaving: false, resolve })
      })
    })

    return () => {
      if (cursorTimerRef.current !== null) {
        window.clearTimeout(cursorTimerRef.current)
      }
      setPanelDirty(panelId, false)
      registerPanelCloseGuard(panelId, null)
    }
  }, [dirty, panelId, registerPanelCloseGuard, setPanelDirty])

  const handleSelectFile = useCallback(
    async (filePath: string) => {
      if (dirty && !window.confirm('Discard unsaved changes and open another file?')) {
        return
      }

      if (activeFileRef.current?.path && activeFileRef.current.path !== filePath) {
        await teardownEditorBeforeFileSwitch()
      }

      await loadFile(filePath, 1, 1)
    },
    [dirty, loadFile, teardownEditorBeforeFileSwitch]
  )

  const handleToggleDirectory = useCallback((path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleCursorChange = useCallback(() => {
    const position = editorRef.current?.getPosition()
    if (!position) {
      return
    }

    if (cursorTimerRef.current !== null) {
      window.clearTimeout(cursorTimerRef.current)
    }

    cursorTimerRef.current = window.setTimeout(() => {
      updatePanelLayout(panelId, {
        cursorLine: position.lineNumber,
        cursorColumn: position.column
      })
    }, 180)
  }, [panelId, updatePanelLayout])

  const handleEditorMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    const themeName = ensureCentipedeMonacoTheme(monaco, resolvedTheme)
    monaco.editor.setTheme(themeName)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void saveFile()
    })
    editor.onDidChangeCursorPosition(() => {
      handleCursorChange()
    })
    applyCursorPosition()
  }, [applyCursorPosition, handleCursorChange, resolvedTheme, saveFile])

  useEffect(() => {
    if (!monacoRef.current) {
      return
    }

    const themeName = ensureCentipedeMonacoTheme(monacoRef.current, resolvedTheme)
    monacoRef.current.editor.setTheme(themeName)
  }, [resolvedTheme])

  useEffect(() => {
    applyCursorPosition()
  }, [activeFile?.path, applyCursorPosition])

  useEffect(() => {
    if (!autoFocus || !editorRef.current || !activeFile) {
      if (autoFocus && fallbackEditorRef.current && activeFile && editorError) {
        requestAnimationFrame(() => {
          fallbackEditorRef.current?.focus()
        })
      }
      return
    }

    requestAnimationFrame(() => {
      editorRef.current?.focus()
    })
  }, [activeFile, autoFocus, editorError])

  const treeChildren = useMemo(() => tree?.children ?? [], [tree])

  const relativePathLabel = activeFile?.relativePath ?? null

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-raised px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-semibold text-text-primary">
              {getRelativeDisplayPath(relativePathLabel)}
            </p>
            {dirty ? (
              <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                Dirty
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] text-text-muted">{projectPath}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void reloadFile()} disabled={!activeFile || isLoadingFile}>
            Reload
          </Button>
          <Button variant="primary" size="sm" onClick={() => void saveFile()} disabled={!activeFile || !dirty || isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {conflictMessage ? (
        <div className="border-b border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger">
          {conflictMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="w-[220px] shrink-0 border-r border-border-subtle bg-bg-raised/60">
          <div className="border-b border-border-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Project Files
          </div>
          <div className="h-full overflow-auto p-2">
            {treeError ? (
              <p className="text-xs text-danger">{treeError}</p>
            ) : tree ? (
              treeChildren.length > 0 ? (
                <div className="space-y-0.5">
                  {treeChildren.map((node) => (
                    <FileTreeItem
                      key={node.path}
                      node={node}
                      expandedPaths={expandedPaths}
                      selectedPath={selectedFilePath}
                      onToggleDirectory={handleToggleDirectory}
                      onSelectFile={(path) => void handleSelectFile(path)}
                    />
                  ))}
                </div>
              ) : (
                <p className="px-2 py-3 text-xs text-text-muted">No files found in this project root.</p>
              )
            ) : (
              <p className="px-2 py-3 text-xs text-text-muted">Loading files…</p>
            )}
          </div>
        </aside>

        <div className="relative min-h-0 flex-1">
          {isLoadingFile ? (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">
              Loading file…
            </div>
          ) : loadError ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div className="max-w-sm">
                <p className="text-sm font-medium text-text-primary">{loadError.title}</p>
                <p className="mt-2 text-xs leading-5 text-text-muted">{loadError.description}</p>
              </div>
            </div>
          ) : activeFile && !editorError ? (
            <EditorCrashBoundary
              key={activeFile.path}
              onError={(error) => {
                console.error('[file-panel] Monaco editor crashed:', error)
                setEditorError(error.message || 'The editor failed to initialize.')
              }}
            >
              <MonacoEditor
                path={getMonacoModelPath(activeFile.path)}
                defaultLanguage={activeFile.language}
                defaultValue={currentContent}
                onMount={handleEditorMount}
                onChange={(value) => setCurrentContent(value ?? '')}
                onValidate={() => undefined}
                saveViewState={false}
                options={{
                  automaticLayout: true,
                  fontSize: 12,
                  minimap: { enabled: false },
                  readOnly: false,
                  scrollBeyondLastLine: false,
                  wordWrap: 'off',
                  renderWhitespace: 'selection',
                  padding: { top: 14, bottom: 18 }
                }}
                theme={resolvedTheme === 'dark' ? 'centipede-dark' : 'centipede-light'}
              />
            </EditorCrashBoundary>
          ) : editorError && activeFile ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-warning/30 bg-warning/8 px-3 py-2 text-xs text-warning">
                Monaco failed to initialize. Using the plain text fallback editor. {editorError}
              </div>
              <textarea
                ref={fallbackEditorRef}
                value={currentContent}
                onChange={(event) => setCurrentContent(event.target.value)}
                className="h-full w-full flex-1 resize-none bg-bg px-4 py-3 font-mono text-[12px] leading-5 text-text-primary outline-none"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center">
              <div className="max-w-sm">
                <p className="text-sm font-medium text-text-primary">Select a file to start editing</p>
                <p className="mt-2 text-xs leading-5 text-text-muted">
                  Each file panel edits one file at a time. Pick a file from the project tree to load it into Monaco.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={closeDialog !== null}
        onClose={() => {
          closeDialog?.resolve(false)
          setCloseDialog(null)
        }}
        title="Unsaved changes"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Save changes to <span className="font-medium text-text-primary">{relativePathLabel ?? 'this file'}</span> before closing this panel?
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                closeDialog?.resolve(false)
                setCloseDialog(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                closeDialog?.resolve(true)
                setCloseDialog(null)
              }}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={closeDialog?.isSaving}
              onClick={async () => {
                if (!closeDialog) {
                  return
                }

                setCloseDialog({ ...closeDialog, isSaving: true })
                const didSave = await saveFile()
                closeDialog.resolve(didSave)
                setCloseDialog(null)
              }}
            >
              {closeDialog?.isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
