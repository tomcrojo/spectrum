import { execFileSync } from 'node:child_process'
import type { ProjectIcon } from '@shared/project.types'
import { DEFAULT_PROJECT_ICON, normalizeProjectIcon } from '@shared/project.types'

const repoOriginCache = new Map<string, string | null>()

export function resolveProjectIcon(
  input: unknown,
  repoPath: string
): ProjectIcon | null {
  const normalized = deserializeProjectIcon(input) ?? DEFAULT_PROJECT_ICON

  if (normalized.type !== 'repo-favicon') {
    return normalized
  }

  const resolvedOrigin = resolveRepoOriginFromGit(repoPath)
  if (resolvedOrigin) {
    return {
      type: 'repo-favicon',
      value: resolvedOrigin
    }
  }

  return normalized.value
    ? {
        type: 'repo-favicon',
        value: normalized.value
      }
    : {
        type: 'repo-favicon'
      }
}

export function serializeProjectIcon(input: unknown): string | null {
  const normalized = deserializeProjectIcon(input)
  return normalized ? JSON.stringify(normalized) : null
}

export function deserializeProjectIcon(input: unknown): ProjectIcon | null {
  if (typeof input === 'string') {
    try {
      return normalizeProjectIcon(JSON.parse(input))
    } catch {
      return null
    }
  }

  return normalizeProjectIcon(input)
}

function resolveRepoOriginFromGit(repoPath: string): string | null {
  const cached = repoOriginCache.get(repoPath)
  if (cached !== undefined) {
    return cached
  }

  try {
    const remoteUrl = execFileSync(
      'git',
      ['-C', repoPath, 'config', '--get', 'remote.origin.url'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    ).trim()

    const origin = parseGitRemoteToOrigin(remoteUrl)
    repoOriginCache.set(repoPath, origin)
    return origin
  } catch {
    repoOriginCache.set(repoPath, null)
    return null
  }
}

function parseGitRemoteToOrigin(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      return `${url.protocol}//${url.host}`
    } catch {
      return null
    }
  }

  const sshMatch = trimmed.match(/^(?:ssh:\/\/)?git@([^:/]+)[:/]([^#]+)$/)
  if (!sshMatch) {
    return null
  }

  const host = sshMatch[1]?.trim()
  return host ? `https://${host}` : null
}
