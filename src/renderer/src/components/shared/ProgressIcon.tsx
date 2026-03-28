import { cn } from '@renderer/lib/cn'

interface ProgressIconProps {
  progress: 0 | 1 | 2 | 3
  size?: number
  className?: string
}

const colors = [
  'text-progress-0',
  'text-progress-1',
  'text-progress-2',
  'text-progress-3'
]

// SVG circle progress indicators: ◔ (25%), ◑ (50%), ◕ (75%), ⚫ (100%)
function ProgressSvg({ progress, size = 14 }: { progress: number; size: number }) {
  const r = size / 2 - 1
  const cx = size / 2
  const cy = size / 2

  if (progress === 0) {
    // Empty circle with quarter fill
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.4} />
        <path
          d={`M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 0,1 ${cx + r},${cy} Z`}
          fill="currentColor"
          opacity={0.6}
        />
      </svg>
    )
  }

  if (progress === 1) {
    // Half filled circle
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.4} />
        <path
          d={`M${cx},${cy - r} A${r},${r} 0 0,0 ${cx},${cy + r} L${cx},${cy} Z`}
          fill="currentColor"
        />
      </svg>
    )
  }

  if (progress === 2) {
    // Three-quarter filled
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="currentColor" />
        <path
          d={`M${cx},${cy} L${cx + r},${cy} A${r},${r} 0 0,1 ${cx},${cy - r} Z`}
          fill="var(--color-bg)"
          opacity={0.7}
        />
      </svg>
    )
  }

  // Full circle (progress === 3)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="currentColor" />
    </svg>
  )
}

export function ProgressIcon({ progress, size = 14, className }: ProgressIconProps) {
  return (
    <span className={cn(colors[progress], className)}>
      <ProgressSvg progress={progress} size={size} />
    </span>
  )
}
