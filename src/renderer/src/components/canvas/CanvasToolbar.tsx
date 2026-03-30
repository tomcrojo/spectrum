import { cn } from '@renderer/lib/cn'

interface CanvasToolbarProps {
  canvasZoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onFitToContent: () => void
}

function ToolbarButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'flex h-7 min-w-7 items-center justify-center rounded-md',
        'text-xs text-text-secondary transition-colors',
        'hover:bg-bg-hover hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        className
      )}
      {...props}
    />
  )
}

export function CanvasToolbar({
  canvasZoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToContent
}: CanvasToolbarProps) {
  const percentage = `${Math.round(canvasZoom * 100)}%`

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-border bg-bg-raised p-1 shadow-lg shadow-black/20">
      <ToolbarButton aria-label="Zoom out" onClick={onZoomOut}>
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        className="min-w-12 px-2 font-medium"
        aria-label="Reset zoom"
        onClick={onResetZoom}
      >
        {percentage}
      </ToolbarButton>
      <ToolbarButton aria-label="Zoom in" onClick={onZoomIn}>
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 2.5V9.5M2.5 6H9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </ToolbarButton>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <ToolbarButton aria-label="Fit to content" onClick={onFitToContent}>
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 3H3V6M10 3H13V6M13 10V13H10M6 13H3V10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>
    </div>
  )
}
