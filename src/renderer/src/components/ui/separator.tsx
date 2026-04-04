import type * as React from 'react'
import { cn } from '@renderer/lib/cn'

export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<'div'> & {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}) {
  return (
    <div
      role={decorative ? 'presentation' : 'separator'}
      aria-orientation={orientation}
      data-slot="separator"
      className={cn(
        'shrink-0 bg-border/80',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  )
}
