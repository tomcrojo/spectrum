import { PROJECT_COLOR_PALETTE, type ProjectColor } from '@shared/project.types'

export const PROJECT_COLORS = PROJECT_COLOR_PALETTE

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = Object.fromEntries(
  PROJECT_COLORS.map((color) => [color.id, color.hex])
) as Record<ProjectColor, string>

export const PROJECT_COLOR_NAME: Record<ProjectColor, string> = Object.fromEntries(
  PROJECT_COLORS.map((color) => [color.id, color.name])
) as Record<ProjectColor, string>

export function getProjectColorMeta(color: ProjectColor) {
  return PROJECT_COLORS.find((entry) => entry.id === color) ?? PROJECT_COLORS[0]
}
