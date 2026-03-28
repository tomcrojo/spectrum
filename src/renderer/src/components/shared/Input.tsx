import { cn } from '@renderer/lib/cn'
import { type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full rounded-md border border-border bg-bg-surface px-3 py-1.5 text-sm text-text-primary',
        'placeholder:text-text-muted',
        'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary',
        'placeholder:text-text-muted resize-none',
        'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
