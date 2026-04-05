import {
  DropdownMenu,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { NewCanvasItemMenu, type CanvasMenuOption } from './NewCanvasItemMenu'
import { cn } from '@renderer/lib/cn'

interface EdgeButtonProps {
  /** Determines button orientation and menu placement */
  direction: 'top' | 'bottom' | 'left' | 'right'
  /** Button label text */
  label: string
  /** Direct click handler (used when no menu) */
  onClick?: () => void
  /** If provided, clicking opens a popup menu instead of calling onClick */
  menuOptions?: CanvasMenuOption[]
  /** Fixed width in pixels (for horizontal buttons) */
  width?: number
}

export function EdgeButton({ direction, label, onClick, menuOptions, width }: EdgeButtonProps) {
  const isHorizontal = direction === 'top' || direction === 'bottom'
  const menuSide =
    direction === 'left'
      ? 'right'
      : direction === 'right'
        ? 'left'
        : direction === 'top'
          ? 'bottom'
          : 'top'
  const button = (
    <button
      onClick={menuOptions ? undefined : onClick}
      aria-label={label}
      className={cn(
        'rounded-full border border-dashed border-border/35 bg-background/18 text-[11px] text-muted-foreground/72 backdrop-blur-md transition-colors',
        'hover:border-border/55 hover:bg-background/28 hover:text-foreground/84',
        'flex items-center justify-center gap-1.5',
        isHorizontal ? 'h-9 w-full px-2.5' : 'w-9 flex-1'
      )}
    >
      {isHorizontal ? (
        <>
          <svg className="h-2.5 w-2.5 opacity-70" viewBox="0 0 12 12" fill="none">
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
  )

  return (
    <div
      className={cn(
        'relative',
        isHorizontal ? (width ? '' : 'w-full') : 'self-stretch flex items-stretch'
      )}
      style={isHorizontal && width ? { width } : undefined}
    >
      {menuOptions ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
          <NewCanvasItemMenu panelOptions={menuOptions} side={menuSide} align="start" />
        </DropdownMenu>
      ) : (
        button
      )}
    </div>
  )
}
