import { PROJECT_COLOR_PALETTE, type ProjectColor } from '@shared/project.types'

export const PROJECT_COLORS = PROJECT_COLOR_PALETTE
const THEME_COLOR_SURFACE = {
  light: '#fafaf9',
  dark: '#1a1a1a',
} as const
const MIN_PROJECT_COLOR_CONTRAST = 4.5

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = Object.fromEntries(
  PROJECT_COLORS.map((color) => [color.id, color.hex])
) as Record<ProjectColor, string>

export const PROJECT_COLOR_NAME: Record<ProjectColor, string> = Object.fromEntries(
  PROJECT_COLORS.map((color) => [color.id, color.name])
) as Record<ProjectColor, string>

export function getProjectColorMeta(color: ProjectColor) {
  return PROJECT_COLORS.find((entry) => entry.id === color) ?? PROJECT_COLORS[0]
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
    (color) => getContrastRatio(color.hex, backgroundHex) >= MIN_PROJECT_COLOR_CONTRAST
  )
}

export function getRandomProjectColorForTheme(theme: 'light' | 'dark'): ProjectColor {
  const eligibleColors = getProjectColorsForTheme(theme)
  const palette = eligibleColors.length > 0 ? eligibleColors : PROJECT_COLORS
  const index = Math.floor(Math.random() * palette.length)

  return palette[index].id
}
