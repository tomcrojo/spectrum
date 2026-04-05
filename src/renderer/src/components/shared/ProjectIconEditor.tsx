import { useEffect, useRef, useState } from 'react'
import { Button } from '@renderer/components/shared/Button'
import { Input } from '@renderer/components/shared/Input'
import { ProjectAvatar, ProjectGlyph } from '@renderer/components/shared/ProjectAvatar'
import { cn } from '@renderer/lib/cn'
import type { ProjectColor, ProjectIcon } from '@shared/project.types'
import { PROJECT_ICON_GLYPHS } from '@shared/project.types'

interface ProjectIconEditorProps {
  value: ProjectIcon | null | undefined
  onChange: (icon: ProjectIcon) => void
  name: string
  color?: ProjectColor
  repoPath?: string
}

const EMOJI_OPTIONS = ['🤖', '⚡', '🧠', '🚀', '📦', '🌐', '🛠️', '✨', '🧪', '📚', '🎯', '🛰️']
const TAB_OPTIONS = [
  { id: 'repo-favicon', label: 'Repo' },
  { id: 'image', label: 'Image' },
  { id: 'icon', label: 'Icon' },
  { id: 'emoji', label: 'Emoji' }
] as const

type IconTab = (typeof TAB_OPTIONS)[number]['id']

export function ProjectIconEditor({
  value,
  onChange,
  name,
  color,
  repoPath
}: ProjectIconEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<IconTab>(value?.type ?? 'repo-favicon')

  useEffect(() => {
    setActiveTab(value?.type ?? 'repo-favicon')
  }, [value?.type])

  const imageValue = value?.type === 'image' ? value.value : ''
  const emojiValue = value?.type === 'emoji' ? value.value : ''

  const handleUpload = async (file: File | null) => {
    if (!file) {
      return
    }

    const reader = new FileReader()
    const dataUrl = await new Promise<string | null>((resolve) => {
      reader.onerror = () => resolve(null)
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.readAsDataURL(file)
    })

    if (dataUrl) {
      onChange({ type: 'image', value: dataUrl })
    }
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-raised/65 p-3">
      <div className="flex items-center gap-3">
        <ProjectAvatar icon={value} name={name} color={color} size={40} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary">Project icon</div>
          <div className="text-xs text-text-muted">
            {value?.type === 'repo-favicon'
              ? repoPath
                ? 'Uses the remote origin favicon for this repo.'
                : 'Add a repo path to pull the remote favicon.'
              : value?.type === 'image'
                ? 'Image URL or uploaded file.'
                : value?.type === 'emoji'
                  ? 'Emoji-style icon.'
                  : 'Notion-style glyph icon.'}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0"
          onClick={() => {
            setActiveTab('repo-favicon')
            onChange({ type: 'repo-favicon' })
          }}
        >
          Reset
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-bg p-1">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id)
              if (tab.id === 'repo-favicon') {
                onChange({ type: 'repo-favicon' })
              }
            }}
            className={cn(
              'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-bg-active text-text-primary'
                : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'repo-favicon' ? (
        <div className="mt-3 rounded-lg border border-border-subtle bg-bg/45 px-3 py-2 text-xs text-text-secondary">
          {repoPath ? (
            <>
              Spectrum will inspect <span className="text-text-primary">{repoPath}</span> and
              use the favicon from its git remote host.
            </>
          ) : (
            'Pick a repository path first, then Spectrum can read the git remote favicon.'
          )}
        </div>
      ) : null}

      {activeTab === 'image' ? (
        <div className="mt-3 space-y-2">
          <Input
            value={imageValue}
            onChange={(event) => onChange({ type: 'image', value: event.target.value })}
            placeholder="https://example.com/logo.png"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Image
            </Button>
            <span className="text-xs text-text-muted">PNG, JPG, SVG, or a pasted URL</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleUpload(event.target.files?.[0] ?? null)
              event.currentTarget.value = ''
            }}
          />
        </div>
      ) : null}

      {activeTab === 'icon' ? (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {PROJECT_ICON_GLYPHS.map((glyph) => (
            <button
              key={glyph.id}
              type="button"
              onClick={() => onChange({ type: 'icon', value: glyph.id })}
              className={cn(
                'flex h-12 flex-col items-center justify-center gap-1 rounded-lg border transition-colors',
                value?.type === 'icon' && value.value === glyph.id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-bg hover:bg-bg-hover text-text-secondary hover:text-text-primary'
              )}
              title={glyph.name}
            >
              <ProjectGlyph glyph={glyph.id} className="h-4 w-4" />
              <span className="text-[10px]">{glyph.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === 'emoji' ? (
        <div className="mt-3 space-y-2">
          <Input
            value={emojiValue}
            onChange={(event) => onChange({ type: 'emoji', value: event.target.value })}
            placeholder="✨"
            maxLength={4}
          />
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onChange({ type: 'emoji', value: emoji })}
                className={cn(
                  'flex h-10 items-center justify-center rounded-lg border text-lg transition-colors',
                  value?.type === 'emoji' && value.value === emoji
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-bg hover:bg-bg-hover'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
