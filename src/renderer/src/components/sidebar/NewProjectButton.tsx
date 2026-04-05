import { Add01FreeIcons } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@renderer/components/shared/Button'

interface NewProjectButtonProps {
  onClick: () => void
}

export function NewProjectButton({ onClick }: NewProjectButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      className="w-full justify-start gap-2.5 rounded-xl border border-border/55 bg-background/44 px-3 py-2 text-left text-xs text-text-secondary shadow-none hover:border-border/70 hover:bg-bg-hover/52 hover:text-text-primary"
    >
      <span className="rounded-full bg-foreground/4 p-1.5 text-text-secondary">
        <HugeiconsIcon icon={Add01FreeIcons} size={14} strokeWidth={1.8} />
      </span>
      <span>New Project</span>
    </Button>
  )
}
