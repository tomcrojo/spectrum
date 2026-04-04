import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@renderer/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/15 bg-primary/10 text-primary',
        secondary: 'border-border bg-secondary/80 text-secondary-foreground',
        outline: 'border-border/80 bg-background/70 text-foreground',
        muted: 'border-transparent bg-muted/80 text-muted-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
