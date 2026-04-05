import { useState, useRef, useEffect } from 'react'
import { Button } from '@renderer/components/shared/Button'
import { ProjectAvatar } from '@renderer/components/shared/ProjectAvatar'
import { ProjectIconEditor } from '@renderer/components/shared/ProjectIconEditor'
import { ColorPicker } from '@renderer/components/shared/ColorPicker'
import { getProjectColorMeta, getProjectMeshGradient } from '@renderer/lib/project-colors'
import { useProjectsStore } from '@renderer/stores/projects.store'
import type { Project, ProjectColor, ProjectIcon } from '@shared/project.types'

interface ProjectHeaderProps {
  project: Project
  color: ProjectColor
  onColorChange: (color: ProjectColor) => void
}

function formatRepoPath(repoPath: string, visibleAncestors = 2): string {
  const separator = repoPath.includes('\\') ? '\\' : '/'
  const trimmedPath = repoPath.replace(/[\\/]+$/, '')
  const segments = trimmedPath.split(/[\\/]+/).filter(Boolean)
  const visibleSegmentCount = visibleAncestors + 1

  if (segments.length <= visibleSegmentCount) {
    return trimmedPath
  }

  return `…${separator}${segments.slice(-visibleSegmentCount).join(separator)}`
}

export function ProjectHeader({ project, color, onColorChange }: ProjectHeaderProps) {
  const { updateProject } = useProjectsStore()
  const [editingDescription, setEditingDescription] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [description, setDescription] = useState(project.description)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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

  const displayRepoPath = formatRepoPath(project.repoPath)
  const colorMeta = getProjectColorMeta(color)
  const colorPreview = getProjectMeshGradient(color)

  return (
    <div className="mb-5 px-1.5">
      {/* ── Hero: avatar + name ── */}
      <div className="mb-4 flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => {
            setIconDraft(project.icon ?? { type: 'repo-favicon' })
            setShowIconEditor((open) => !open)
          }}
          className="project-theme-avatar-button rounded-[1.1rem] transition-all duration-200 hover:scale-[1.04] hover:brightness-110 focus-visible:outline-none"
          title="Change project icon"
        >
          <ProjectAvatar
            icon={project.icon}
            name={project.name}
            color={color}
            size={52}
            className="rounded-[14px] border-none bg-bg/72 text-white"
          />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.035em] leading-tight text-text-primary">
            {project.name}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="max-w-full select-text cursor-text truncate rounded-md bg-bg-hover/50 px-2 py-0.5 font-mono text-[11px] text-text-muted"
              title={project.repoPath}
            >
              {displayRepoPath}
            </span>
            {project.gitWorkspacesEnabled && (
              <span className="rounded-md bg-bg-hover/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                git workspaces
              </span>
            )}
          </div>
        </div>

        {/* Color picker trigger — compact, positioned at the end */}
        <button
          type="button"
          onClick={() => setShowColorPicker((open) => !open)}
          className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 transition-all duration-200 hover:scale-110 hover:border-white/20 focus-visible:outline-none"
          style={{
            background: colorPreview,
            backgroundSize: '200% 200%',
            backgroundPosition: 'center',
            boxShadow: `0 4px 12px color-mix(in oklab, ${colorMeta.primary} 20%, rgba(0, 0, 0, 0.3))`,
          }}
          title={`Change project color: ${colorMeta.name}`}
          aria-label={`Change project color: ${colorMeta.name}`}
        >
          <span className="absolute inset-[2px] rounded-full border border-white/8" />
        </button>
      </div>

      {/* ── Icon editor (expandable) ── */}
      {showIconEditor && (
        <div className="mb-4 space-y-2">
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
      )}

      {/* ── Color picker (expandable) ── */}
      {showColorPicker && (
        <div className="mb-4 rounded-xl border border-border-subtle bg-bg/60 p-3 backdrop-blur-sm">
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

      {/* ── Description ── */}
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
          className="project-theme-description w-full rounded-lg px-3 py-2 text-[13px] leading-relaxed text-text-secondary resize-none outline-none focus:border-[var(--project-border)]"
          rows={2}
          placeholder="Add a description..."
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingDescription(true)}
          className="project-theme-description w-full text-left min-h-[36px] cursor-text rounded-lg px-3 py-2 text-[13px] leading-relaxed text-text-secondary transition-all duration-200 hover:text-text-primary"
        >
          {project.description || (
            <span className="text-text-muted/70 font-light">
              Add a description…
            </span>
          )}
        </button>
      )}
    </div>
  )
}
