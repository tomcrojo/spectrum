import { type InputHTMLAttributes } from 'react'
import { Input as UiInput } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return <UiInput className={className} {...props} />
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-[1.4rem] border border-transparent bg-input/55 px-4 py-3 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[color,box-shadow,background-color] outline-none',
        'placeholder:text-muted-foreground resize-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30',
        'disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}
