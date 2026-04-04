import { useState, useRef, useEffect } from 'react'
import { Button } from '@renderer/components/shared/Button'
import { ProjectAvatar } from '@renderer/components/shared/ProjectAvatar'
import { ProjectIconEditor } from '@renderer/components/shared/ProjectIconEditor'
import { ColorPicker } from '@renderer/components/shared/ColorPicker'
import { getProjectColorMeta } from '@renderer/lib/project-colors'
import { useProjectsStore } from '@renderer/stores/projects.store'
import type { Project, ProjectColor, ProjectIcon } from '@shared/project.types'

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
  const [showIconEditor, setShowIconEditor] = useState(false)
  const [iconDraft, setIconDraft] = useState<ProjectIcon>(project.icon ?? { type: 'repo-favicon' })

  useEffect(() => {
    setDescription(project.description)
  }, [project.description])

  useEffect(() => {
    setIconDraft(project.icon ?? { type: 'repo-favicon' })
  }, [project.icon])

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

  const saveIcon = () => {
    setShowIconEditor(false)
    updateProject({ id: project.id, icon: iconDraft })
  }

  return (
    <div className="mb-3">
      <div className="project-theme-card mb-3 rounded-xl px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setIconDraft(project.icon ?? { type: 'repo-favicon' })
              setShowIconEditor((open) => !open)
            }}
            className="project-theme-avatar-button rounded-xl transition-transform hover:scale-[1.01]"
            title="Change project icon"
          >
            <ProjectAvatar icon={project.icon} name={project.name} color={color} size={38} className="rounded-[10px] border-none bg-bg/80 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-[-0.03em] text-text-primary">{project.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIconDraft(project.icon ?? { type: 'repo-favicon' })
                  setShowIconEditor((open) => !open)
                }}
                className="inline-flex h-5 items-center rounded-md px-1 text-[11px] leading-none text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                Change icon
              </button>
              <button
                type="button"
                onClick={() => setShowColorPicker((open) => !open)}
                className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border/80 bg-bg/70 px-2 py-0.5 text-[11px] font-medium leading-none text-text-secondary transition-colors hover:border-border hover:text-text-primary"
                title="Change project color"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: colorMeta.primary }} />
                <span>{colorMeta.name}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showIconEditor ? (
        <div className="mb-3 space-y-2">
          <ProjectIconEditor
            value={iconDraft}
            onChange={setIconDraft}
            name={project.name}
            color={color}
            repoPath={project.repoPath}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIconDraft(project.icon ?? { type: 'repo-favicon' })
                setShowIconEditor(false)
              }}
            >
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={saveIcon}>
              Save Icon
            </Button>
          </div>
        </div>
      ) : null}

      {showColorPicker && (
        <div className="mb-3 rounded-xl border border-border-subtle bg-bg/70 p-3">
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
          className="project-theme-description w-full rounded-lg px-2.5 py-1.5 text-[13px] text-text-secondary resize-none outline-none focus:border-[var(--project-border)]"
          rows={2}
          placeholder="Add a description..."
        />
      ) : (
        <p
          onClick={() => setEditingDescription(true)}
          className="project-theme-description min-h-[36px] cursor-text rounded-lg px-2.5 py-1.5 text-[13px] text-text-secondary transition-colors hover:text-text-primary"
        >
          {project.description || (
            <span className="text-text-muted italic">
              Click to add a description...
            </span>
          )}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <span className="select-text cursor-text rounded-full border border-border/70 bg-bg/65 px-2 py-0.5">
          {project.repoPath}
        </span>
        {project.gitWorkspacesEnabled && (
          <span className="rounded-full border border-border/80 bg-bg/65 px-2 py-0.5 text-text-secondary">
            git workspaces
          </span>
        )}
      </div>
      </div>
    </div>
  )
}
