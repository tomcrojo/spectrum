import { cn } from '@renderer/lib/cn'
import { PROJECT_COLOR_HEX } from '@renderer/lib/project-colors'
import { PROJECT_COLORS, type ProjectColor } from '@shared/project.types'

interface ColorPickerProps {
  value: ProjectColor
  onChange: (color: ProjectColor) => void
  size?: 'sm' | 'md'
}

export function ColorPicker({ value, onChange, size = 'md' }: ColorPickerProps) {
  const dotSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6'

  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_COLORS.map((color) => {
        const hex = PROJECT_COLOR_HEX[color]
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'rounded-full transition-all duration-150',
              dotSize,
              selected
                ? 'ring-2 ring-offset-2 ring-offset-bg-surface scale-110'
                : 'hover:scale-110'
            )}
            style={{
              background: hex,
              ...(selected ? { '--tw-ring-color': hex } as React.CSSProperties : {}),
            }}
            title={color.charAt(0).toUpperCase() + color.slice(1)}
          />
        )
      })}
    </div>
  )
}
