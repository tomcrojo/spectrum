import type { ProjectIcon } from '@shared/project.types'

export function getProjectIconImageSrc(icon: ProjectIcon | null | undefined): string | null {
  if (!icon) {
    return null
  }

  if (icon.type === 'image') {
    return icon.value
  }

  if (icon.type === 'repo-favicon') {
    const origin = icon.value?.trim()
    if (!origin) {
      return null
    }

    return `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(origin)}`
  }

  return null
}

export function getProjectInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed.charAt(0).toUpperCase() || '•'
}
