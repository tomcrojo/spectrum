export const PROJECT_COLOR_PALETTE = [
  {
    id: 'lavender-dusk',
    name: 'Lavender Dusk',
    primary: '#7B2CBF',
    stops: {
      base: '#0e0518',       // near-black plum — deep enough that everything pops
      blob1: '#9b30ff',      // hot violet — bleeds from top-left
      blob2: '#e040fb',      // electric magenta — bleeds from bottom-right (warm)
      blob3: '#2563eb',      // sapphire blue — bleeds from bottom-left (cool crossing)
      shimmer: '#c4b5fd',    // pale lilac — conic sweep highlight
    },
  },
  {
    id: 'sea-glass',
    name: 'Sea Glass',
    primary: '#2A9D8F',
    stops: {
      base: '#021211',       // abyssal teal-black
      blob1: '#14b8a6',      // bright teal — top-left bleed
      blob2: '#67e8f9',      // ice cyan — bottom-right bleed (cool extreme)
      blob3: '#d946ef',      // fuchsia accent — bottom-left (warm crossing)
      shimmer: '#a7f3d0',    // mint highlight — conic sweep
    },
  },
  {
    id: 'amber-glow',
    name: 'Amber Glow',
    primary: '#F4B942',
    stops: {
      base: '#120700',       // burnt umber black
      blob1: '#f59e0b',      // deep amber — top-left bleed
      blob2: '#dc2626',      // crimson — bottom-right bleed (warm extreme)
      blob3: '#2563eb',      // cobalt blue — top-right (cool crossing)
      shimmer: '#fde68a',    // pale gold — conic sweep
    },
  },
  {
    id: 'wild-rose',
    name: 'Wild Rose',
    primary: '#E56B6F',
    stops: {
      base: '#10030a',       // deep burgundy black
      blob1: '#f43f5e',      // hot coral — top-left bleed
      blob2: '#a855f7',      // violet — bottom-right (cool crossing)
      blob3: '#0d9488',      // teal — bottom-left (temperature conflict)
      shimmer: '#fda4af',    // blush pink — conic sweep
    },
  },
  {
    id: 'northern-lights',
    name: 'Northern Lights',
    primary: '#3AAFA9',
    stops: {
      base: '#020a14',       // midnight navy
      blob1: '#06b6d4',      // electric cyan — top-left bleed
      blob2: '#8b5cf6',      // bright violet — bottom-right (warm crossing)
      blob3: '#10b981',      // emerald — bottom-left (cool side)
      shimmer: '#67e8f9',    // ice blue — conic sweep
    },
  },
  {
    id: 'molten-ember',
    name: 'Molten Ember',
    primary: '#E85D04',
    stops: {
      base: '#0f0200',       // charred black
      blob1: '#ea580c',      // deep orange — top-left bleed
      blob2: '#b91c1c',      // blood crimson — bottom-right (warm extreme)
      blob3: '#eab308',      // molten gold — top-right
      shimmer: '#fdba74',    // peach glow — conic sweep
    },
  },
  {
    id: 'midnight-bloom',
    name: 'Midnight Bloom',
    primary: '#5A189A',
    stops: {
      base: '#060012',       // void purple-black
      blob1: '#7c3aed',      // rich violet — top-left bleed
      blob2: '#ec4899',      // hot pink — bottom-right (warm crossing)
      blob3: '#1d4ed8',      // deep blue — bottom-left (cool crossing)
      shimmer: '#c084fc',    // orchid glow — conic sweep
    },
  },
] as const

export type ProjectColor = (typeof PROJECT_COLOR_PALETTE)[number]['id']

const LEGACY_PROJECT_COLOR_MAP: Record<string, ProjectColor> = {
  // Old flat color IDs → nearest gradient theme
  'molten-lava': 'molten-ember',
  'flag-red': 'molten-ember',
  'persimmon': 'molten-ember',
  'papaya-whip': 'amber-glow',
  'gilded-honey': 'amber-glow',
  'citron': 'sea-glass',
  'moss-garden': 'sea-glass',
  'deep-forest': 'sea-glass',
  'lagoon': 'sea-glass',
  'verdigris': 'northern-lights',
  'deep-space-blue': 'northern-lights',
  'steel-blue': 'northern-lights',
  'storm-blue': 'northern-lights',
  'cobalt-glow': 'northern-lights',
  'indigo-night': 'midnight-bloom',
  'violet-haze': 'lavender-dusk',
  'iris': 'lavender-dusk',
  'orchid': 'midnight-bloom',
  'neon-orchid': 'midnight-bloom',
  'rose-dust': 'wild-rose',
  'coral-bloom': 'wild-rose',
  'terracotta': 'amber-glow',
  'sienna-clay': 'amber-glow',
  'espresso': 'molten-ember',
  'charcoal': 'northern-lights',
  'graphite': 'midnight-bloom',
  'moonstone': 'lavender-dusk',
  'arctic-mint': 'sea-glass',
  'mint-julep': 'sea-glass',
  'sunlit-lemon': 'amber-glow',
  'apricot': 'wild-rose',
  'dusty-peach': 'wild-rose',
  'merlot': 'wild-rose',
  'midnight-plum': 'midnight-bloom',
  // Old legacy color names
  slate: 'midnight-bloom',
  red: 'molten-ember',
  orange: 'molten-ember',
  amber: 'amber-glow',
  emerald: 'sea-glass',
  teal: 'northern-lights',
  cyan: 'sea-glass',
  sky: 'northern-lights',
  blue: 'northern-lights',
  indigo: 'midnight-bloom',
  violet: 'lavender-dusk',
  purple: 'midnight-bloom',
  fuchsia: 'midnight-bloom',
  pink: 'wild-rose',
  rose: 'wild-rose',
}

export const DEFAULT_PROJECT_COLOR = PROJECT_COLOR_PALETTE[0].id

export const PROJECT_ICON_GLYPHS = [
  { id: 'spark', name: 'Spark' },
  { id: 'terminal', name: 'Terminal' },
  { id: 'folder', name: 'Folder' },
  { id: 'planet', name: 'Planet' },
  { id: 'rocket', name: 'Rocket' },
  { id: 'grid', name: 'Grid' },
  { id: 'chip', name: 'Chip' },
  { id: 'book', name: 'Book' },
] as const

export type ProjectIconGlyph = (typeof PROJECT_ICON_GLYPHS)[number]['id']

export type ProjectIcon =
  | {
      type: 'repo-favicon'
      value?: string | null
    }
  | {
      type: 'image'
      value: string
    }
  | {
      type: 'emoji'
      value: string
    }
  | {
      type: 'icon'
      value: ProjectIconGlyph
    }

export const DEFAULT_PROJECT_ICON: ProjectIcon = { type: 'repo-favicon' }

export function normalizeProjectColor(value: string | null | undefined): ProjectColor {
  if (!value) return DEFAULT_PROJECT_COLOR

  const directMatch = PROJECT_COLOR_PALETTE.find((color) => color.id === value)
  if (directMatch) return directMatch.id

  const legacyMatch = LEGACY_PROJECT_COLOR_MAP[value as keyof typeof LEGACY_PROJECT_COLOR_MAP]
  return legacyMatch ?? DEFAULT_PROJECT_COLOR
}

export function getRandomProjectColor(): ProjectColor {
  const index = Math.floor(Math.random() * PROJECT_COLOR_PALETTE.length)
  return PROJECT_COLOR_PALETTE[index].id
}

export function normalizeProjectIcon(input: unknown): ProjectIcon | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const icon = input as { type?: unknown; value?: unknown }

  if (icon.type === 'repo-favicon') {
    const value = typeof icon.value === 'string' ? icon.value.trim() : ''
    return value ? { type: 'repo-favicon', value } : { type: 'repo-favicon' }
  }

  if (icon.type === 'image') {
    const value = typeof icon.value === 'string' ? icon.value.trim() : ''
    return value ? { type: 'image', value } : null
  }

  if (icon.type === 'emoji') {
    const value = typeof icon.value === 'string' ? icon.value.trim() : ''
    return value ? { type: 'emoji', value } : null
  }

  if (icon.type === 'icon') {
    const value = typeof icon.value === 'string' ? icon.value.trim() : ''
    const isGlyph = PROJECT_ICON_GLYPHS.some((glyph) => glyph.id === value)
    return isGlyph ? { type: 'icon', value: value as ProjectIconGlyph } : null
  }

  return null
}

export interface Project {
  id: string
  name: string
  repoPath: string
  description: string
  color: ProjectColor
  icon: ProjectIcon | null
  gitWorkspacesEnabled: boolean
  defaultBrowserCookiePolicy: 'isolated' | 'shared'
  defaultTerminalMode: 'project-root' | 'workspace'
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  repoPath: string
  description?: string
  color?: ProjectColor
  icon?: ProjectIcon | null
  gitWorkspacesEnabled?: boolean
}

export interface UpdateProjectInput {
  id: string
  name?: string
  description?: string
  color?: ProjectColor
  icon?: ProjectIcon | null
  gitWorkspacesEnabled?: boolean
  defaultBrowserCookiePolicy?: 'isolated' | 'shared'
  defaultTerminalMode?: 'project-root' | 'workspace'
  archived?: boolean
}

export interface Task {
  id: string
  projectId: string
  title: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTaskInput {
  projectId: string
  title: string
}

export interface Decision {
  id: string
  projectId: string
  title: string
  body: string
  createdAt: string
}

export interface Note {
  id: string
  projectId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface EnvVar {
  id: string
  projectId: string
  key: string
  value: string
  secret: boolean
}
