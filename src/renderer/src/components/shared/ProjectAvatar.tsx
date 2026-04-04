import { useEffect, useMemo, useState } from 'react'
import { cn } from '@renderer/lib/cn'
import { PROJECT_COLOR_HEX } from '@renderer/lib/project-colors'
import { getProjectIconImageSrc, getProjectInitial } from '@renderer/lib/project-icons'
import type { ProjectColor, ProjectIcon, ProjectIconGlyph } from '@shared/project.types'

interface ProjectAvatarProps {
  icon: ProjectIcon | null | undefined
  name: string
  color?: ProjectColor
  size?: number
  className?: string
}

export function ProjectAvatar({
  icon,
  name,
  color,
  size = 18,
  className
}: ProjectAvatarProps) {
  const imageSrc = getProjectIconImageSrc(icon)
  const [imageFailed, setImageFailed] = useState(false)
  const accent = color ? PROJECT_COLOR_HEX[color] : '#737373'

  useEffect(() => {
    setImageFailed(false)
  }, [imageSrc])

  const content = useMemo(() => {
    if (imageSrc && !imageFailed) {
      const isRepoFavicon = icon?.type === 'repo-favicon'
      return (
        <img
          src={imageSrc}
          alt=""
          className={cn(
            'h-full w-full',
            isRepoFavicon ? 'object-contain p-[18%]' : 'object-cover'
          )}
          onError={() => setImageFailed(true)}
        />
      )
    }

    if (icon?.type === 'emoji') {
      return (
        <span
          className="leading-none"
          style={{ fontSize: Math.max(11, Math.round(size * 0.58)) }}
        >
          {icon.value}
        </span>
      )
    }

    if (icon?.type === 'icon') {
      return <ProjectGlyph glyph={icon.value} className="h-[58%] w-[58%]" />
    }

    return (
      <span
        className="font-semibold leading-none"
        style={{ fontSize: Math.max(10, Math.round(size * 0.42)) }}
      >
        {getProjectInitial(name)}
      </span>
    )
  }, [icon, imageFailed, imageSrc, name, size])

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-border-subtle bg-bg-raised text-text-secondary shadow-sm',
        className
      )}
      style={{
        width: size,
        height: size,
        color: accent,
        backgroundColor: `${accent}18`,
        borderColor: `${accent}33`
      }}
    >
      {content}
    </div>
  )
}

export function ProjectGlyph({
  glyph,
  className
}: {
  glyph: ProjectIconGlyph
  className?: string
}) {
  if (glyph === 'spark') {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 1.75L9.33 5.02L12.6 6.35L9.33 7.68L8 10.95L6.67 7.68L3.4 6.35L6.67 5.02L8 1.75Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path d="M12 10.5L12.6 12L14.1 12.6L12.6 13.2L12 14.7L11.4 13.2L9.9 12.6L11.4 12L12 10.5Z" fill="currentColor" />
      </svg>
    )
  }

  if (glyph === 'terminal') {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2.25" y="3" width="11.5" height="10" rx="2" stroke="currentColor" strokeWidth="1.25" />
        <path d="M4.75 6L6.75 8L4.75 10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 10H10.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    )
  }

  if (glyph === 'folder') {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.25 5.25C2.25 4.42 2.92 3.75 3.75 3.75H6L7.1 5H12.25C13.08 5 13.75 5.67 13.75 6.5V10.75C13.75 11.58 13.08 12.25 12.25 12.25H3.75C2.92 12.25 2.25 11.58 2.25 10.75V5.25Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (glyph === 'planet') {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.25" />
        <path
          d="M2.5 8.5C3.7 6.3 12.1 4.7 13.5 6.5C14.35 7.6 10.95 10.6 7.2 11.55C4.8 12.15 2.55 11.6 2.5 10.4"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (glyph === 'rocket') {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M9.25 2.25C11.9 2.55 13.45 4.1 13.75 6.75L10.75 9.75L6.25 5.25L9.25 2.25Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path d="M6.25 5.25L4.5 7L5.75 10.25L9 11.5L10.75 9.75" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
        <circle cx="10.25" cy="5.75" r="0.9" fill="currentColor" />
        <path d="M4.25 10.25L2.75 12.75L5.25 11.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (glyph === 'grid') {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2.5" y="2.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.25" />
        <rect x="9.5" y="2.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.25" />
        <rect x="2.5" y="9.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.25" />
        <rect x="9.5" y="9.5" width="4" height="4" rx="1" fill="currentColor" />
      </svg>
    )
  }

  if (glyph === 'chip') {
    return (
      <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
        <path d="M6.5 6.5H9.5V9.5H6.5V6.5Z" stroke="currentColor" strokeWidth="1.25" />
        <path d="M6.5 2V4.25M9.5 2V4.25M6.5 11.75V14M9.5 11.75V14M2 6.5H4.25M2 9.5H4.25M11.75 6.5H14M11.75 9.5H14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.25 3.25H10.5L12.25 5V12.25C12.25 12.8 11.8 13.25 11.25 13.25H4.75C4.2 13.25 3.75 12.8 3.75 12.25V4.25C3.75 3.7 4.2 3.25 4.75 3.25H4.25Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M5.75 6.5H10.25M5.75 8.5H10.25M5.75 10.5H8.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}
