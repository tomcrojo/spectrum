import { loader } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import type { FileTreeNode, ReadFileResult } from '@shared/file.types'
import { Button } from '@renderer/components/shared/Button'
import { Modal } from '@renderer/components/shared/Modal'
import { cn } from '@renderer/lib/cn'
import { filesApi } from '@renderer/lib/ipc'
import { configureMonacoEnvironment } from '@renderer/lib/monaco-environment'
import { ensureSpectrumMonacoTheme } from '@renderer/lib/monaco-theme'
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
  onChromeStateChange?: (state: FilePanelChromeState) => void
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

interface FilePanelBoundaryState {
  error: Error | null
}

interface FilePanelChromeState {
  relativePath: string | null
  isExplorerCollapsed: boolean
  canSave: boolean
  canReload: boolean
  isSaving: boolean
  onSave: (() => void) | null
  onReload: (() => void) | null
  onToggleExplorer: (() => void) | null
}

const treeCache = new Map<string, Promise<FileTreeNode>>()

function getTreeForProject(projectId: string): Promise<FileTreeNode> {
  const existing = treeCache.get(projectId)
  if (existing) {
    return existing
  }

  const nextTree = filesApi.listTree(projectId)
  treeCache.set(projectId, nextTree)
  return nextTree
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

function getModelUri(monaco: typeof Monaco, panelId: string, filePath: string): Monaco.Uri {
  return monaco.Uri.parse(
    `inmemory://spectrum-file-panel/${encodeURIComponent(panelId)}/${encodeURIComponent(filePath)}`
  )
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
          isSelected
            ? 'bg-bg-active text-text-primary'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
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

class FilePanelBoundary extends Component<
  { children: ReactNode },
  FilePanelBoundaryState
> {
  state: FilePanelBoundaryState = {
    error: null
  }

  static getDerivedStateFromError(error: Error): FilePanelBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[FilePanel] render failure', error, errorInfo)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-lg">
          <p className="text-sm font-semibold text-danger">File panel crashed</p>
          <p className="mt-2 text-xs leading-5 text-text-muted">
            {this.state.error.message || 'Unknown renderer error.'}
          </p>
          {this.state.error.stack ? (
            <pre className="mt-4 max-h-64 overflow-auto rounded-md border border-border-subtle bg-bg-raised p-3 text-left text-[11px] leading-5 text-text-secondary whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
          ) : null}
        </div>
      </div>
    )
  }
}

function FilePanelContent({
  panelId,
  workspaceId,
  projectId,
  projectPath,
  initialFilePath,
  initialCursorLine,
  initialCursorColumn,
  autoFocus,
  onChromeStateChange
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
  const [monacoReady, setMonacoReady] = useState(false)
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false)
  const [explorerWidth, setExplorerWidth] = useState(220)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const modelRef = useRef<Monaco.editor.ITextModel | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const fallbackEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const cursorTimerRef = useRef<number | null>(null)
  const pendingSelectionRef = useRef<{ line: number; column: number } | null>(null)
  const activeFileRef = useRef<ActiveFileState | null>(null)
  const applyingProgrammaticValueRef = useRef(false)
  const dirty = activeFile !== null && currentContent !== activeFile.lastSavedContent
  const selectedFilePath = activeFile?.path ?? selectedTreePath
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    activeFileRef.current = activeFile
  }, [activeFile])

  useEffect(() => {
    configureMonacoEnvironment()

    let cancelled = false

    loader
      .init()
      .then((instance) => {
        if (cancelled) {
          return
        }

        monacoRef.current = instance
        setMonacoReady(true)
      })
      .catch((error) => {
        if (!cancelled) {
          setEditorError(error instanceof Error ? error.message : 'Failed to initialize Monaco.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

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

  const applyCursorPosition = useCallback(() => {
    const editor = editorRef.current
    const target = pendingSelectionRef.current
    const model = editor?.getModel()
    if (!editor || !target || !model) {
      return
    }

    const validatedTarget = model.validatePosition(target)
    editor.setPosition(validatedTarget)
    editor.revealPositionInCenter(validatedTarget)
    pendingSelectionRef.current = null
  }, [])

  const ensureEditor = useCallback(() => {
    const monaco = monacoRef.current
    const container = editorContainerRef.current
    if (!monaco || !container || editorRef.current) {
      return
    }

    const themeName = ensureSpectrumMonacoTheme(monaco, resolvedTheme)
    monaco.editor.setTheme(themeName)

    const editor = monaco.editor.create(container, {
      automaticLayout: true,
      fontSize: 12,
      minimap: { enabled: false },
      readOnly: false,
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      renderWhitespace: 'selection',
      padding: { top: 14, bottom: 18 }
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void saveFileRef.current()
    })

    editor.onDidChangeModelContent(() => {
      if (applyingProgrammaticValueRef.current) {
        return
      }

      const value = editor.getValue()
      setCurrentContent(value)
    })

    editor.onDidChangeCursorPosition(() => {
      handleCursorChange()
    })

    editorRef.current = editor
  }, [handleCursorChange, resolvedTheme])

  const disposeModel = useCallback(() => {
    modelRef.current?.dispose()
    modelRef.current = null
  }, [])

  const setEditorModelForFile = useCallback(
    (file: ActiveFileState) => {
      const monaco = monacoRef.current
      const editor = editorRef.current
      if (!monaco || !editor) {
        return
      }

      disposeModel()

      const model = monaco.editor.createModel(
        file.content,
        file.language,
        getModelUri(monaco, panelId, file.path)
      )

      modelRef.current = model
      editor.setModel(model)
      applyCursorPosition()

      if (autoFocus) {
        requestAnimationFrame(() => {
          editor.focus()
        })
      }
    },
    [applyCursorPosition, autoFocus, disposeModel, panelId]
  )

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

  const saveFileRef = useRef(saveFile)
  useEffect(() => {
    saveFileRef.current = saveFile
  }, [saveFile])

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
        disposeModel()
        editorRef.current?.setModel(null)
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
    [applyLoadedFile, disposeModel, panelId, projectId, updatePanelLayout]
  )

  useEffect(() => {
    if (!initialFilePath) {
      return
    }

    void loadFile(initialFilePath, initialCursorLine ?? 1, initialCursorColumn ?? 1)
  }, [initialCursorColumn, initialCursorLine, initialFilePath, loadFile])

  useEffect(() => {
    setPanelDirty(panelId, dirty)
  }, [dirty, panelId, setPanelDirty])

  const reloadFile = useCallback(async () => {
    if (!activeFileRef.current) {
      return
    }

    if (dirty && !window.confirm('Discard unsaved changes and reload from disk?')) {
      return
    }

    const panel = useWorkspacesStore.getState().activePanels.find((entry) => entry.panelId === panelId)
    await loadFile(
      activeFileRef.current.path,
      panel?.cursorLine ?? 1,
      panel?.cursorColumn ?? 1
    )
  }, [dirty, loadFile, panelId])

  const toggleExplorer = useCallback(() => {
    setIsExplorerCollapsed((current) => !current)
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

      await loadFile(filePath, 1, 1)
    },
    [dirty, loadFile]
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

  useEffect(() => {
    if (!monacoReady || !monacoRef.current || !activeFile || editorError) {
      return
    }

    try {
      ensureEditor()
      if (!editorRef.current) {
        return
      }

      setEditorModelForFile(activeFile)
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'The editor failed to initialize.')
    }
  }, [activeFile, editorError, ensureEditor, monacoReady, setEditorModelForFile])

  useEffect(() => {
    const monaco = monacoRef.current
    if (!monaco) {
      return
    }

    const themeName = ensureSpectrumMonacoTheme(monaco, resolvedTheme)
    monaco.editor.setTheme(themeName)
  }, [resolvedTheme])

  useEffect(() => {
    const model = modelRef.current
    if (!model || model.getValue() === currentContent) {
      return
    }

    applyingProgrammaticValueRef.current = true
    model.setValue(currentContent)
    applyingProgrammaticValueRef.current = false
  }, [currentContent])

  useEffect(() => {
    applyCursorPosition()
  }, [activeFile?.path, applyCursorPosition])

  useEffect(() => {
    if (!autoFocus || !activeFile) {
      return
    }

    if (editorRef.current) {
      requestAnimationFrame(() => {
        editorRef.current?.focus()
      })
      return
    }

    if (fallbackEditorRef.current && editorError) {
      requestAnimationFrame(() => {
        fallbackEditorRef.current?.focus()
      })
    }
  }, [activeFile, autoFocus, editorError])

  useEffect(() => {
    return () => {
      disposeModel()
      editorRef.current?.dispose()
      editorRef.current = null
    }
  }, [disposeModel])

  useEffect(() => {
    if (!onChromeStateChange) {
      return
    }

    onChromeStateChange({
      relativePath: activeFile?.relativePath ?? null,
      isExplorerCollapsed,
      canSave: Boolean(activeFile) && dirty && !isSaving,
      canReload: Boolean(activeFile) && !isLoadingFile,
      isSaving,
      onSave: activeFile ? () => void saveFile() : null,
      onReload: activeFile ? () => void reloadFile() : null,
      onToggleExplorer: toggleExplorer
    })

    return () => {
      onChromeStateChange({
        relativePath: null,
        isExplorerCollapsed: false,
        canSave: false,
        canReload: false,
        isSaving: false,
        onSave: null,
        onReload: null,
        onToggleExplorer: null
      })
    }
  }, [
    activeFile,
    dirty,
    isExplorerCollapsed,
    isLoadingFile,
    isSaving,
    onChromeStateChange,
    reloadFile,
    saveFile,
    toggleExplorer
  ])

  const handleExplorerResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: explorerWidth
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const resizeState = resizeStateRef.current
      if (!resizeState) {
        return
      }

      const nextWidth = Math.max(160, Math.min(420, resizeState.startWidth + moveEvent.clientX - resizeState.startX))
      setExplorerWidth(nextWidth)
    }

    const handleMouseUp = () => {
      resizeStateRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [explorerWidth])

  const treeChildren = useMemo(() => tree?.children ?? [], [tree])
  const relativePathLabel = activeFile?.relativePath ?? null

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      {conflictMessage ? (
        <div className="border-b border-danger/30 bg-danger/8 px-3 py-2 text-xs text-danger">
          {conflictMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {!isExplorerCollapsed ? (
          <>
            <aside
              className="shrink-0 border-r border-border-subtle bg-bg-raised/60"
              style={{ width: explorerWidth }}
            >
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
            <div
              className="group relative w-1 shrink-0 cursor-col-resize bg-border-subtle/70 transition-colors hover:bg-accent/50"
              onMouseDown={handleExplorerResizeStart}
            >
              <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
            </div>
          </>
        ) : null}

        <div className="relative min-h-0 flex-1">
          {loadError ? (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div className="max-w-sm">
                <p className="text-sm font-medium text-text-primary">{loadError.title}</p>
                <p className="mt-2 text-xs leading-5 text-text-muted">{loadError.description}</p>
              </div>
            </div>
          ) : activeFile && editorError ? (
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
          ) : activeFile ? (
            <div className="relative h-full w-full">
              <div ref={editorContainerRef} className="h-full w-full" />
              {isLoadingFile ? (
                <div className="absolute inset-0 flex items-center justify-center bg-bg/70 text-xs text-text-muted backdrop-blur-[1px]">
                  Loading file…
                </div>
              ) : null}
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

export function FilePanel(props: FilePanelProps) {
  return (
    <FilePanelBoundary>
      <FilePanelContent {...props} />
    </FilePanelBoundary>
  )
}
