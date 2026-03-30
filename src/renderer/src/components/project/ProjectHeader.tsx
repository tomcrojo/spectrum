import { useState, useRef, useEffect } from 'react'
import { ProgressIcon } from '@renderer/components/shared/ProgressIcon'
import { ColorPicker } from '@renderer/components/shared/ColorPicker'
import { getProjectColorMeta } from '@renderer/lib/project-colors'
import { useProjectsStore } from '@renderer/stores/projects.store'
import type { Project, ProjectColor } from '@shared/project.types'

interface ProjectHeaderProps {
  project: Project
  color: ProjectColor
  onColorChange: (color: ProjectColor) => void
}

export function ProjectHeader({ project, color, onColorChange }: ProjectHeaderProps) {
  const { updateProject } = useProjectsStore()
  const [editingDescription, setEditingDescription] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [description, setDescription] = useState(project.description)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const colorMeta = getProjectColorMeta(color)

  useEffect(() => {
    setDescription(project.description)
  }, [project.description])

  useEffect(() => {
    if (editingDescription && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.selectionStart = textareaRef.current.value.length
    }
  }, [editingDescription])

  const saveDescription = () => {
    setEditingDescription(false)
    if (description !== project.description) {
      updateProject({ id: project.id, description })
    }
  }

  const cycleProgress = () => {
    const next = ((project.progress + 1) % 4) as 0 | 1 | 2 | 3
    updateProject({ id: project.id, progress: next })
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={cycleProgress}
          className="hover:opacity-80 transition-opacity"
          title="Click to change progress"
        >
          <ProgressIcon progress={project.progress} size={20} />
        </button>
        <h1 className="text-xl font-bold text-text-primary">{project.name}</h1>
      </div>

      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowColorPicker((open) => !open)}
          className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-sm font-medium transition-opacity hover:opacity-85"
          style={{ color: colorMeta.hex }}
          title="Change project color"
        >
          <span>~{colorMeta.name}</span>
          <span className="text-xs tracking-[0.08em] opacity-70">{colorMeta.hex}</span>
        </button>
        {showColorPicker && (
          <div className="mt-3 rounded-xl border border-border-subtle bg-bg-raised p-3">
            <ColorPicker
              value={color}
              onChange={(nextColor) => {
                onColorChange(nextColor)
                setShowColorPicker(false)
              }}
              size="sm"
            />
          </div>
        )}
      </div>

      {editingDescription ? (
        <textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveDescription}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDescription(project.description)
              setEditingDescription(false)
            }
          }}
          className="w-full bg-transparent text-sm text-text-secondary resize-none outline-none border-b border-border-subtle focus:border-accent py-1"
          rows={2}
          placeholder="Add a description..."
        />
      ) : (
        <p
          onClick={() => setEditingDescription(true)}
          className="text-sm text-text-secondary cursor-text hover:text-text-primary transition-colors py-1 min-h-[28px]"
        >
          {project.description || (
            <span className="text-text-muted italic">
              Click to add a description...
            </span>
          )}
        </p>
      )}

      <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
        <span className="select-text cursor-text">
          {project.repoPath}
        </span>
        {project.gitWorkspacesEnabled && (
          <span className="px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-secondary">
            git workspaces
          </span>
        )}
      </div>
    </div>
  )
}
