import { PROJECT_COLORS, getProjectMeshGradient } from '@renderer/lib/project-colors'
import type { ProjectColor } from '@shared/project.types'

interface ColorPickerProps {
  value: ProjectColor
  onChange: (color: ProjectColor) => void
  size?: 'sm' | 'md'
}

export function ColorPicker({ value, onChange, size = 'md' }: ColorPickerProps) {
  const swatchSize = size === 'sm' ? 40 : 48

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {PROJECT_COLORS.map((theme) => {
          const selected = value === theme.id
          const previewGradient = getProjectMeshGradient(theme.id)

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onChange(theme.id)}
              className="group relative flex justify-center overflow-visible rounded-full transition-all duration-150 focus-visible:outline-none"
              style={{
                width: swatchSize,
                height: swatchSize,
                background: previewGradient,
                backgroundSize: '185% 185%',
                backgroundPosition: 'center',
                outline: selected
                  ? `2px solid ${theme.primary}`
                  : '2px solid transparent',
                outlineOffset: selected ? '2px' : '0px',
                transform: selected ? 'scale(1.03)' : undefined,
                boxShadow: selected
                  ? `0 0 12px color-mix(in oklab, ${theme.primary} 60%, transparent)`
                  : '0 2px 6px rgba(0,0,0,0.3)',
              }}
              aria-label={theme.name}
              title={theme.name}
            >
              {/* Shimmer overlay on hover */}
              <span
                className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                style={{
                  background: `linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)`,
                }}
              />

              {selected ? (
                <span
                  className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold"
                  style={{
                    color: 'rgba(255,255,255,0.95)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.7)',
                  }}
                >
                  ✓
                </span>
              ) : null}

              <span
                className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 -translate-y-1 rounded-full border border-white/10 bg-black/88 px-2.5 py-1 text-[10px] font-medium tracking-wide whitespace-nowrap text-white opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
              >
                {theme.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
