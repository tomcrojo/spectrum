import { existsSync, readFileSync } from 'fs'
import { dirname, join, resolve } from 'path'

export interface T3CodeConfig {
  sourcePath: string
  installCommand: string
  buildCommand: string
  entrypoint: string
}

interface SpectrumConfigFile {
  t3code?: Partial<T3CodeConfig>
}

const T3CODE_ENTRYPOINT_CANDIDATES = [
  'apps/server/dist/bin.mjs',
  'apps/server/dist/index.mjs'
] as const

function findProjectRoot(): string {
  const candidates = [
    process.cwd(),
    __dirname,
    dirname(require.main?.filename ?? process.cwd())
  ]

  for (const candidate of candidates) {
    let current = resolve(candidate)

    while (true) {
      const configPath = join(current, 'spectrum.config.json')
      const t3CodePackagePath = join(current, 'resources', 't3code', 'package.json')

      if (existsSync(configPath) || existsSync(t3CodePackagePath)) {
        return current
      }

      const parent = dirname(current)
      if (parent === current) {
        break
      }
      current = parent
    }
  }

  return process.cwd()
}

const projectRoot = findProjectRoot()

function getPackagedT3CodePath(): string | null {
  const resourcesPath = process.resourcesPath
  if (!resourcesPath) {
    return null
  }

  const candidate = join(resourcesPath, 't3code')
  return existsSync(join(candidate, 'package.json')) ? candidate : null
}

function findExistingT3CodeSourcePath(preferredPath?: string): string {
  const candidates = [
    preferredPath,
    getPackagedT3CodePath(),
    join(projectRoot, 'resources', 't3code')
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    const resolvedCandidate = resolve(candidate)
    if (existsSync(join(resolvedCandidate, 'package.json'))) {
      return resolvedCandidate
    }
  }

  for (const base of [process.cwd(), __dirname, dirname(require.main?.filename ?? process.cwd())]) {
    let current = resolve(base)

    while (true) {
      const nestedCandidate = join(current, 'resources', 't3code')
      if (existsSync(join(nestedCandidate, 'package.json'))) {
        return nestedCandidate
      }

      const parent = dirname(current)
      if (parent === current) {
        break
      }
      current = parent
    }
  }

  return resolve(preferredPath ?? join(projectRoot, 'resources', 't3code'))
}

function resolveT3CodeEntrypoint(
  sourcePath: string,
  preferredEntrypoint?: string
): string {
  const candidates = [
    preferredEntrypoint,
    ...T3CODE_ENTRYPOINT_CANDIDATES
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (existsSync(join(sourcePath, candidate))) {
      return candidate
    }
  }

  return preferredEntrypoint ?? T3CODE_ENTRYPOINT_CANDIDATES[0]
}

const defaultSourcePath = findExistingT3CodeSourcePath(
  join(projectRoot, 'resources', 't3code')
)

const defaultConfig: T3CodeConfig = {
  sourcePath: defaultSourcePath,
  installCommand: 'bun install --frozen-lockfile',
  buildCommand: 'bun run --cwd apps/web build && bun run --cwd apps/server build',
  entrypoint: resolveT3CodeEntrypoint(defaultSourcePath)
}

let cachedConfig: T3CodeConfig | null = null

export function getT3CodeConfig(): T3CodeConfig {
  if (cachedConfig) return cachedConfig

  const configPath = join(projectRoot, 'spectrum.config.json')
  if (!existsSync(configPath)) {
    cachedConfig = defaultConfig
    return cachedConfig
  }

  try {
    const parsed = JSON.parse(
      readFileSync(configPath, 'utf8')
    ) as SpectrumConfigFile

    const sourcePath = findExistingT3CodeSourcePath(
      parsed.t3code?.sourcePath
        ? resolve(projectRoot, parsed.t3code.sourcePath)
        : defaultConfig.sourcePath
    )

    cachedConfig = {
      sourcePath,
      installCommand: parsed.t3code?.installCommand || defaultConfig.installCommand,
      buildCommand: parsed.t3code?.buildCommand || defaultConfig.buildCommand,
      entrypoint: resolveT3CodeEntrypoint(
        sourcePath,
        parsed.t3code?.entrypoint || defaultConfig.entrypoint
      )
    }
  } catch {
    cachedConfig = defaultConfig
  }

  return cachedConfig
}
