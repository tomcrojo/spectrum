import { ColorPicker } from '@renderer/components/shared/ColorPicker'
import type { ProjectColor } from '@shared/project.types'

interface ProjectSettingsProps {
  color: ProjectColor
  onColorChange: (color: ProjectColor) => void
}

export function ProjectSettings({ color, onColorChange }: ProjectSettingsProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Settings
      </h3>
      <div>
        <label className="block text-xs text-text-secondary mb-2">
          Project Color
        </label>
        <ColorPicker
          value={color}
          onChange={onColorChange}
          size="sm"
        />
      </div>
    </div>
  )
}
