import { useState, useRef, useCallback } from 'react'
import { cn } from '@renderer/lib/cn'
import { TerminalPanel } from './TerminalPanel'

interface WorkspacePanelProps {
  workspaceId: string
  workspaceName: string
  projectId: string
  cwd: string
  terminalId: string
  onClose: () => void
  style?: React.CSSProperties
}

export function WorkspacePanel({
  workspaceId,
  workspaceName,
  projectId,
  cwd,
  terminalId,
  onClose,
  style
}: WorkspacePanelProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [size, setSize] = useState({ width: 700, height: 450 })
  const panelRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      startPos.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height }

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startPos.current.x
        const dy = ev.clientY - startPos.current.y
        setSize({
          width: Math.max(400, startPos.current.w + dx),
          height: Math.max(250, startPos.current.h + dy)
        })
      }

      const onMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [size]
  )

  return (
    <div
      ref={panelRef}
      className={cn(
        'relative flex flex-col rounded-lg border border-border',
        'bg-bg shadow-lg shadow-black/30',
        isResizing && 'select-none'
      )}
      style={{
        width: size.width,
        height: size.height,
        ...style
      }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-raised border-b border-border-subtle flex-shrink-0 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-progress-1" />
          <span className="text-xs font-medium text-text-secondary truncate">
            {workspaceName}
          </span>
          <span className="text-[10px] text-text-muted truncate">
            {cwd}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded hover:bg-bg-hover flex-shrink-0"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3L9 9M9 3L3 9"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <TerminalPanel
          terminalId={terminalId}
          cwd={cwd}
          projectId={projectId}
          workspaceId={workspaceId}
        />
      </div>

      {/* Resize handle — bottom-right corner */}
      <div
        onMouseDown={onResizeStart}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
        style={{ touchAction: 'none' }}
      >
        <svg
          className="w-3 h-3 text-text-muted opacity-30 absolute bottom-0.5 right-0.5"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M10 2L2 10M10 6L6 10M10 10L10 10"
            stroke="currentColor"
            strokeWidth={1}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}
