import { useMemo } from 'react'
import { PROJECT_COLORS } from '@renderer/lib/project-colors'
import type { ProjectColor } from '@shared/project.types'

interface ColorPickerProps {
  value: ProjectColor
  onChange: (color: ProjectColor) => void
  size?: 'sm' | 'md'
}

const HEX_CONFIG = {
  sm: { w: 32, h: 36, vStep: 27, offset: 16 },
  md: { w: 40, h: 46, vStep: 34.5, offset: 20 },
} as const

const COLS = 6
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

/** Convert a hex color string to its HSL hue (0–360). */
function hexToHue(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = ((n >> 16) & 0xff) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  if (d === 0) return 0

  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4

  h = Math.round(h * 60)
  return h < 0 ? h + 360 : h
}

/** Sort palette colors by hue so the grid reads like a color wheel. */
function sortByHue(
  colors: readonly { id: string; name: string; hex: string }[]
): typeof PROJECT_COLORS[number][] {
  return [...colors].sort((a, b) => hexToHue(a.hex) - hexToHue(b.hex)) as typeof PROJECT_COLORS[number][]
}

export function ColorPicker({ value, onChange, size = 'md' }: ColorPickerProps) {
  const { w, h, vStep, offset } = HEX_CONFIG[size]

  const sorted = useMemo(() => sortByHue(PROJECT_COLORS), [])

  const rows: (typeof PROJECT_COLORS[number])[][] = []
  for (let i = 0; i < sorted.length; i += COLS) {
    rows.push(sorted.slice(i, i + COLS))
  }

  return (
    <div className="space-y-0">
      <div style={{ paddingRight: offset }}>
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex"
            style={{
              marginTop: rowIndex === 0 ? 0 : vStep - h,
              marginLeft: rowIndex % 2 === 1 ? offset : 0,
            }}
          >
            {row.map((color) => {
              const selected = value === color.id
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => onChange(color.id)}
                  className="relative flex-shrink-0 group"
                  style={{ width: w, height: h }}
                  title={`${color.name} ${color.hex}`}
                >
                  <span
                    className="absolute inset-0 transition-transform duration-150 group-hover:-translate-y-0.5"
                    style={{
                      background: color.hex,
                      clipPath: HEX_CLIP,
                      filter: selected
                        ? 'drop-shadow(0 0 3px rgba(255,255,255,0.55))'
                        : undefined,
                      transform: selected ? 'scale(1.08)' : undefined,
                    }}
                  />
                  {selected && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white z-10"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="pt-3 text-xs text-text-muted">
        {PROJECT_COLORS.find((c) => c.id === value)?.name} ·{' '}
        {PROJECT_COLORS.find((c) => c.id === value)?.hex}
      </div>
    </div>
  )
}
