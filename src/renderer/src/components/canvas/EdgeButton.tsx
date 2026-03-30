import { useState, useCallback } from 'react'
import { cn } from '@renderer/lib/cn'

interface MenuOption {
  label: string
  description: string
  onSelect: () => void
}

interface EdgeButtonProps {
  /** Determines button orientation and menu placement */
  direction: 'top' | 'bottom' | 'left' | 'right'
  /** Button label text */
  label: string
  /** Direct click handler (used when no menu) */
  onClick?: () => void
  /** If provided, clicking opens a popup menu instead of calling onClick */
  menuOptions?: MenuOption[]
  /** Fixed width in pixels (for horizontal buttons) */
  width?: number
}

export function EdgeButton({ direction, label, onClick, menuOptions, width }: EdgeButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)

  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (menuOptions) {
      const rect = event.currentTarget.getBoundingClientRect()
      setMenuPosition({
        left: event.clientX - rect.left,
        top: event.clientY - rect.top
      })
      setShowMenu((prev) => !prev)
    } else if (onClick) {
      onClick()
    }
  }, [menuOptions, onClick])

  const isHorizontal = direction === 'top' || direction === 'bottom'

  return (
    <div
      className={cn('relative', isHorizontal ? (width ? '' : 'w-full') : 'self-stretch flex items-stretch')}
      style={isHorizontal && width ? { width } : undefined}
    >
      <button
        onClick={handleClick}
        aria-label={label}
        className={cn(
          'border border-dashed rounded-lg',
          'border-text-muted/35 hover:border-text-secondary/50',
          'text-[11px] text-text-muted/65 hover:text-text-secondary',
          'transition-colors bg-transparent hover:bg-bg-raised/20',
          'flex items-center justify-center gap-1.5',
          isHorizontal ? 'w-full h-9' : 'w-9 flex-1'
        )}
        >
        {isHorizontal ? (
          <>
            <svg
              className="w-2.5 h-2.5 opacity-70"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path
                d="M6 2V10M2 6H10"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </svg>
            <span>{label}</span>
          </>
        ) : (
          <span className="text-lg leading-none">+</span>
        )}
      </button>

      {showMenu && menuOptions && (
        <>
          <button
            aria-label="Close menu"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => {
              setShowMenu(false)
              setMenuPosition(null)
            }}
          />
          <div
            className={cn(
              'absolute z-30 w-56 rounded-xl border border-border bg-bg-raised p-2 shadow-2xl shadow-black/35'
            )}
            style={
              menuPosition
                ? {
                    left:
                      direction === 'left'
                        ? menuPosition.left + 12
                        : menuPosition.left - 224,
                    top: Math.max(0, menuPosition.top - 24)
                  }
                : undefined
            }
          >
            <div className="px-2 pb-2 pt-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                New Panel
              </p>
            </div>
            <div className="space-y-1">
              {menuOptions.map((option) => (
                <button
                  key={option.label}
                  onClick={() => {
                    setShowMenu(false)
                    setMenuPosition(null)
                    option.onSelect()
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                >
                  <div className="text-sm font-medium text-text-primary">{option.label}</div>
                  <div className="mt-1 text-xs leading-4 text-text-muted">
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
