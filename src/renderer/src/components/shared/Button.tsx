import type { ButtonHTMLAttributes } from 'react'
import { Button as UiButton } from '@renderer/components/ui/button'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variants: Record<ButtonVariant, 'default' | 'outline' | 'ghost' | 'destructive'> = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  danger: 'destructive'
}

const sizes: Record<ButtonSize, 'sm' | 'default'> = {
  sm: 'sm',
  md: 'default'
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <UiButton
      variant={variants[variant]}
      size={sizes[size]}
      className={className}
      {...props}
    />
  )
}
