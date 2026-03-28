import { Button } from '@renderer/components/shared/Button'

interface NewProjectButtonProps {
  onClick: () => void
}

export function NewProjectButton({ onClick }: NewProjectButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="w-full justify-start gap-2 text-text-muted hover:text-text-primary"
    >
      <svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <path
          d="M7 2.5V11.5M2.5 7H11.5"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
      New Project
    </Button>
  )
}
