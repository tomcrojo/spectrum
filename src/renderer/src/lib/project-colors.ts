import { PROJECT_COLOR_PALETTE, type ProjectColor } from '@shared/project.types'

export const PROJECT_COLORS = PROJECT_COLOR_PALETTE
const THEME_COLOR_SURFACE = {
  light: '#fafaf9',
  dark: '#1a1a1a',
} as const
const MIN_PROJECT_COLOR_CONTRAST = 4.5

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = Object.fromEntries(
  PROJECT_COLORS.map((color) => [color.id, color.primary])
) as Record<ProjectColor, string>

export const PROJECT_COLOR_NAME: Record<ProjectColor, string> = Object.fromEntries(
  PROJECT_COLORS.map((color) => [color.id, color.name])
) as Record<ProjectColor, string>

export function getProjectColorMeta(color: ProjectColor) {
  return PROJECT_COLORS.find((entry) => entry.id === color) ?? PROJECT_COLORS[0]
}

// ── Per-color mesh gradient layouts ──
// Each color gets a structurally distinct gradient: different blob positions,
// sizes, conic angles, and layering to make them feel unique.
type ColorMeta = (typeof PROJECT_COLORS)[number]

function getMeshLayers(meta: ColorMeta): string[] {
  const { stops: { base, blob1, blob2, blob3, shimmer } } = meta

  switch (meta.id) {
    // ── Lavender Dusk: diagonal curtain — top-right to bottom-left sweep ──
    case 'lavender-dusk':
      return [
        `conic-gradient(
          from 160deg at 82% 18%,
          transparent 0%,
          color-mix(in oklab, ${shimmer} 18%, transparent) 8%,
          transparent 22%,
          color-mix(in oklab, ${blob1} 12%, transparent) 38%,
          transparent 52%
        )`,
        `radial-gradient(
          ellipse 140% 200% at 105% -30%,
          color-mix(in oklab, ${blob1} 82%, white 18%) 0%,
          color-mix(in oklab, ${blob1} 38%, transparent) 28%,
          transparent 52%
        )`,
        `radial-gradient(
          ellipse 200% 120% at -20% 120%,
          color-mix(in oklab, ${blob2} 72%, black 18%) 0%,
          color-mix(in oklab, ${blob2} 32%, transparent) 34%,
          transparent 58%
        )`,
        `radial-gradient(
          ellipse 80% 80% at 50% 50%,
          color-mix(in oklab, ${blob3} 28%, transparent) 0%,
          transparent 60%
        )`,
        `radial-gradient(
          ellipse 60% 90% at -8% 20%,
          color-mix(in oklab, ${shimmer} 36%, white 14%) 0%,
          color-mix(in oklab, ${shimmer} 14%, transparent) 32%,
          transparent 50%
        )`,
        base,
      ]

    // ── Sea Glass: ocean floor — wide horizontal band, deep verticals ──
    case 'sea-glass':
      return [
        `linear-gradient(
          172deg,
          color-mix(in oklab, ${blob1} 22%, transparent) 0%,
          transparent 40%,
          color-mix(in oklab, ${blob3} 16%, transparent) 70%,
          transparent 100%
        )`,
        `radial-gradient(
          ellipse 220% 80% at 50% 110%,
          color-mix(in oklab, ${blob2} 68%, black 18%) 0%,
          color-mix(in oklab, ${blob2} 28%, transparent) 38%,
          transparent 62%
        )`,
        `radial-gradient(
          ellipse 100% 180% at -18% 50%,
          color-mix(in oklab, ${blob1} 76%, white 12%) 0%,
          color-mix(in oklab, ${blob1} 34%, transparent) 30%,
          transparent 54%
        )`,
        `radial-gradient(
          ellipse 80% 160% at 112% 40%,
          color-mix(in oklab, ${blob3} 54%, black 22%) 0%,
          color-mix(in oklab, ${blob3} 22%, transparent) 32%,
          transparent 52%
        )`,
        `radial-gradient(
          ellipse 50% 50% at 70% -10%,
          color-mix(in oklab, ${shimmer} 44%, white 16%) 0%,
          color-mix(in oklab, ${shimmer} 16%, transparent) 34%,
          transparent 56%
        )`,
        base,
      ]

    // ── Amber Glow: volcanic — top-heavy with molten pool at bottom ──
    case 'amber-glow':
      return [
        `conic-gradient(
          from 40deg at 30% 70%,
          transparent 0%,
          color-mix(in oklab, ${blob2} 16%, transparent) 12%,
          transparent 28%,
          color-mix(in oklab, ${shimmer} 10%, transparent) 48%,
          transparent 64%
        )`,
        `radial-gradient(
          ellipse 200% 100% at 50% -40%,
          color-mix(in oklab, ${blob1} 80%, white 10%) 0%,
          color-mix(in oklab, ${blob1} 36%, transparent) 32%,
          transparent 56%
        )`,
        `radial-gradient(
          ellipse 160% 140% at 110% 130%,
          color-mix(in oklab, ${blob2} 74%, black 16%) 0%,
          color-mix(in oklab, ${blob2} 30%, transparent) 36%,
          transparent 58%
        )`,
        `radial-gradient(
          ellipse 90% 120% at -14% -10%,
          color-mix(in oklab, ${blob3} 52%, black 28%) 0%,
          color-mix(in oklab, ${blob3} 22%, transparent) 28%,
          transparent 48%
        )`,
        `radial-gradient(
          ellipse 140% 60% at 60% 120%,
          color-mix(in oklab, ${shimmer} 38%, white 12%) 0%,
          color-mix(in oklab, ${shimmer} 14%, transparent) 32%,
          transparent 54%
        )`,
        base,
      ]

    // ── Wild Rose: scattered petals — asymmetric blobs, no conic ──
    case 'wild-rose':
      return [
        `radial-gradient(
          ellipse 120% 160% at 90% -20%,
          color-mix(in oklab, ${blob1} 84%, white 16%) 0%,
          color-mix(in oklab, ${blob1} 40%, transparent) 26%,
          transparent 50%
        )`,
        `radial-gradient(
          ellipse 140% 100% at -10% 80%,
          color-mix(in oklab, ${blob2} 70%, black 14%) 0%,
          color-mix(in oklab, ${blob2} 30%, transparent) 34%,
          transparent 56%
        )`,
        `radial-gradient(
          ellipse 70% 70% at 60% 110%,
          color-mix(in oklab, ${blob3} 48%, black 28%) 0%,
          color-mix(in oklab, ${blob3} 20%, transparent) 28%,
          transparent 50%
        )`,
        `radial-gradient(
          ellipse 80% 60% at 30% 10%,
          color-mix(in oklab, ${shimmer} 32%, white 18%) 0%,
          color-mix(in oklab, ${shimmer} 12%, transparent) 30%,
          transparent 52%
        )`,
        `linear-gradient(
          210deg,
          color-mix(in oklab, ${blob1} 10%, transparent) 0%,
          transparent 50%,
          color-mix(in oklab, ${blob2} 8%, transparent) 100%
        )`,
        base,
      ]

    // ── Northern Lights: vertical curtains — tall narrow columns ──
    case 'northern-lights':
      return [
        `conic-gradient(
          from 290deg at 20% 50%,
          transparent 0%,
          color-mix(in oklab, ${blob1} 18%, transparent) 6%,
          transparent 16%,
          color-mix(in oklab, ${shimmer} 12%, transparent) 32%,
          transparent 44%,
          color-mix(in oklab, ${blob3} 10%, transparent) 62%,
          transparent 78%
        )`,
        `radial-gradient(
          ellipse 60% 220% at 18% 50%,
          color-mix(in oklab, ${blob1} 80%, white 14%) 0%,
          color-mix(in oklab, ${blob1} 36%, transparent) 28%,
          transparent 52%
        )`,
        `radial-gradient(
          ellipse 50% 200% at 55% 40%,
          color-mix(in oklab, ${blob2} 64%, black 20%) 0%,
          color-mix(in oklab, ${blob2} 28%, transparent) 30%,
          transparent 52%
        )`,
        `radial-gradient(
          ellipse 70% 180% at 88% 60%,
          color-mix(in oklab, ${blob3} 58%, black 22%) 0%,
          color-mix(in oklab, ${blob3} 24%, transparent) 28%,
          transparent 50%
        )`,
        `radial-gradient(
          ellipse 40% 100% at 40% -10%,
          color-mix(in oklab, ${shimmer} 48%, white 16%) 0%,
          color-mix(in oklab, ${shimmer} 18%, transparent) 30%,
          transparent 54%
        )`,
        base,
      ]

    // ── Molten Ember: lava flow — bottom-heavy, horizontal spread ──
    case 'molten-ember':
      return [
        `linear-gradient(
          8deg,
          color-mix(in oklab, ${blob2} 24%, transparent) 0%,
          transparent 35%,
          color-mix(in oklab, ${blob3} 12%, transparent) 65%,
          transparent 100%
        )`,
        `radial-gradient(
          ellipse 200% 120% at 40% 130%,
          color-mix(in oklab, ${blob1} 86%, white 8%) 0%,
          color-mix(in oklab, ${blob1} 40%, transparent) 30%,
          transparent 54%
        )`,
        `radial-gradient(
          ellipse 140% 100% at 115% 20%,
          color-mix(in oklab, ${blob3} 66%, black 18%) 0%,
          color-mix(in oklab, ${blob3} 28%, transparent) 32%,
          transparent 54%
        )`,
        `radial-gradient(
          ellipse 100% 160% at -12% 60%,
          color-mix(in oklab, ${blob2} 60%, black 22%) 0%,
          color-mix(in oklab, ${blob2} 24%, transparent) 30%,
          transparent 52%
        )`,
        `radial-gradient(
          ellipse 44% 44% at 72% 80%,
          color-mix(in oklab, ${shimmer} 42%, white 14%) 0%,
          color-mix(in oklab, ${shimmer} 16%, transparent) 32%,
          transparent 56%
        )`,
        base,
      ]

    // ── Midnight Bloom: nebula — centered glow with radial falloff ──
    case 'midnight-bloom':
      return [
        `conic-gradient(
          from 90deg at 50% 50%,
          color-mix(in oklab, ${blob1} 14%, transparent) 0%,
          transparent 14%,
          color-mix(in oklab, ${blob2} 12%, transparent) 28%,
          transparent 42%,
          color-mix(in oklab, ${blob3} 10%, transparent) 56%,
          transparent 72%,
          color-mix(in oklab, ${shimmer} 8%, transparent) 86%,
          transparent 100%
        )`,
        `radial-gradient(
          ellipse 80% 80% at 50% 45%,
          color-mix(in oklab, ${blob1} 58%, black 18%) 0%,
          color-mix(in oklab, ${blob1} 22%, transparent) 36%,
          transparent 60%
        )`,
        `radial-gradient(
          ellipse 160% 120% at 100% 100%,
          color-mix(in oklab, ${blob2} 72%, black 14%) 0%,
          color-mix(in oklab, ${blob2} 28%, transparent) 32%,
          transparent 56%
        )`,
        `radial-gradient(
          ellipse 130% 110% at 0% 0%,
          color-mix(in oklab, ${blob3} 56%, black 24%) 0%,
          color-mix(in oklab, ${blob3} 22%, transparent) 28%,
          transparent 50%
        )`,
        `radial-gradient(
          ellipse 40% 40% at 50% 45%,
          color-mix(in oklab, ${shimmer} 52%, white 18%) 0%,
          color-mix(in oklab, ${shimmer} 20%, transparent) 28%,
          transparent 52%
        )`,
        base,
      ]

    // Fallback — generic layout
    default:
      return [
        `conic-gradient(
          from 218deg at 68% 28%,
          transparent 0%,
          color-mix(in oklab, ${shimmer} 14%, transparent) 10%,
          transparent 26%,
          color-mix(in oklab, ${blob2} 10%, transparent) 42%,
          transparent 58%,
          color-mix(in oklab, ${shimmer} 8%, transparent) 74%,
          transparent 88%
        )`,
        `radial-gradient(
          ellipse 180% 150% at -15% -20%,
          color-mix(in oklab, ${blob1} 88%, white 12%) 0%,
          color-mix(in oklab, ${blob1} 44%, transparent) 30%,
          transparent 56%
        )`,
        `radial-gradient(
          ellipse 160% 180% at 118% 115%,
          color-mix(in oklab, ${blob2} 78%, black 22%) 0%,
          color-mix(in oklab, ${blob2} 36%, transparent) 32%,
          transparent 54%
        )`,
        `radial-gradient(
          ellipse 120% 100% at -10% 112%,
          color-mix(in oklab, ${blob3} 64%, black 24%) 0%,
          color-mix(in oklab, ${blob3} 28%, transparent) 30%,
          transparent 52%
        )`,
        `radial-gradient(
          ellipse 90% 80% at 108% -14%,
          color-mix(in oklab, ${shimmer} 42%, white 18%) 0%,
          color-mix(in oklab, ${shimmer} 18%, transparent) 28%,
          transparent 50%
        )`,
        base,
      ]
  }
}

export function getProjectThemeStyle(color: ProjectColor): Record<`--${string}`, string> {
  const meta = getProjectColorMeta(color)
  const { primary, stops: { base, blob1, blob2, blob3, shimmer } } = meta

  // ── Line gradient: 4-stop ribbon with warm→cool crossing ──
  const line = `linear-gradient(
    135deg,
    ${blob1} 0%,
    color-mix(in oklab, ${blob1} 55%, ${blob2} 45%) 30%,
    color-mix(in oklab, ${blob2} 50%, ${blob3} 50%) 65%,
    ${blob3} 100%
  )`

  // ── Mesh gradient: each color gets a structurally distinct layout ──
  const mesh = getMeshLayers(meta).join(',\n    ')

  return {
    '--project-accent': primary,
    '--project-line': line,
    '--project-mesh': mesh,
    '--project-tint': `color-mix(in oklab, ${primary} 12%, transparent)`,
    '--project-tint-strong': `color-mix(in oklab, ${primary} 22%, transparent)`,
    '--project-border': `color-mix(in oklab, ${primary} 22%, var(--color-border))`
  }
}

export function getProjectMeshGradient(color: ProjectColor): string {
  return getMeshLayers(getProjectColorMeta(color)).join(',\n    ')
}

function getRelativeLuminance(hex: string): number {
  const normalizedHex = hex.replace('#', '')
  const channels = [0, 2, 4]
    .map((index) => normalizedHex.slice(index, index + 2))
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    )

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2])
}

export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const foreground = getRelativeLuminance(foregroundHex)
  const background = getRelativeLuminance(backgroundHex)
  const lighter = Math.max(foreground, background)
  const darker = Math.min(foreground, background)

  return (lighter + 0.05) / (darker + 0.05)
}

export function getProjectColorsForTheme(theme: 'light' | 'dark') {
  const backgroundHex = THEME_COLOR_SURFACE[theme]

  return PROJECT_COLORS.filter(
    (color) => getContrastRatio(color.primary, backgroundHex) >= MIN_PROJECT_COLOR_CONTRAST
  )
}

export function getRandomProjectColorForTheme(theme: 'light' | 'dark'): ProjectColor {
  const eligibleColors = getProjectColorsForTheme(theme)
  const palette = eligibleColors.length > 0 ? eligibleColors : PROJECT_COLORS
  const index = Math.floor(Math.random() * palette.length)

  return palette[index].id
}
