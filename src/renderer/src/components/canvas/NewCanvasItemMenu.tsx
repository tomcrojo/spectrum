import type { ComponentProps } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/lib/cn'

export interface CanvasMenuOption {
  icon: Parameters<typeof HugeiconsIcon>[0]['icon']
  label: string
  description: string
  onSelect: () => void
}

interface NewCanvasItemMenuProps {
  panelOptions: CanvasMenuOption[]
  workspaceOption?: CanvasMenuOption
  side?: ComponentProps<typeof DropdownMenuContent>['side']
  align?: ComponentProps<typeof DropdownMenuContent>['align']
  className?: string
}

export function NewCanvasItemMenu({
  panelOptions,
  workspaceOption,
  side = 'bottom',
  align = 'start',
  className
}: NewCanvasItemMenuProps) {
  return (
    <DropdownMenuContent
      side={side}
      align={align}
      sideOffset={12}
      className={cn(
        'w-[19.25rem] min-w-[19.25rem] rounded-[1.75rem] border-border/38 bg-popover/84 p-1.5 text-foreground before:rounded-[inherit]',
        className
      )}
    >
      <DropdownMenuLabel className="px-3.5 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/66">
        New Panel
      </DropdownMenuLabel>

      {panelOptions.map((option) => (
        <DropdownMenuItem
          key={option.label}
          onSelect={option.onSelect}
          className="items-start rounded-[1.35rem] px-3 py-2.5"
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border/40 bg-foreground/[0.04] text-foreground/70">
              <HugeiconsIcon icon={option.icon} size={16} strokeWidth={1.8} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.75">
              <span className="text-[0.95rem] font-medium tracking-[-0.02em] text-foreground/90">
                {option.label}
              </span>
              <span className="max-w-[14.5rem] text-[0.82rem] leading-5 text-muted-foreground/74">
                {option.description}
              </span>
            </div>
          </div>
        </DropdownMenuItem>
      ))}

      {workspaceOption ? (
        <>
          <DropdownMenuSeparator className="mx-1.5 my-1.5" />
          <DropdownMenuLabel className="px-3.5 pb-1 pt-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/66">
            New Workspace
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={workspaceOption.onSelect}
            className="items-start rounded-[1.35rem] px-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border/40 bg-foreground/[0.04] text-foreground/70">
                <HugeiconsIcon icon={workspaceOption.icon} size={16} strokeWidth={1.8} />
              </div>
              <div className="flex min-w-0 flex-col gap-0.75">
                <span className="text-[0.95rem] font-medium tracking-[-0.02em] text-foreground/90">
                  {workspaceOption.label}
                </span>
                <span className="max-w-[14.5rem] text-[0.82rem] leading-5 text-muted-foreground/74">
                  {workspaceOption.description}
                </span>
              </div>
            </div>
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenuContent>
  )
}
