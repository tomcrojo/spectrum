export const PROJECT_COLOR_PALETTE = [
  { id: 'molten-lava', name: 'Molten Lava', hex: '#780000' },
  { id: 'flag-red', name: 'Flag Red', hex: '#C1121F' },
  { id: 'persimmon', name: 'Persimmon', hex: '#E85D04' },
  { id: 'papaya-whip', name: 'Papaya Whip', hex: '#FDF0D5' },
  { id: 'gilded-honey', name: 'Gilded Honey', hex: '#F4B942' },
  { id: 'citron', name: 'Citron', hex: '#A7C957' },
  { id: 'moss-garden', name: 'Moss Garden', hex: '#6A994E' },
  { id: 'deep-forest', name: 'Deep Forest', hex: '#386641' },
  { id: 'sea-glass', name: 'Sea Glass', hex: '#A8DADC' },
  { id: 'lagoon', name: 'Lagoon', hex: '#2A9D8F' },
  { id: 'verdigris', name: 'Verdigris', hex: '#3AAFA9' },
  { id: 'deep-space-blue', name: 'Deep Space Blue', hex: '#003049' },
  { id: 'steel-blue', name: 'Steel Blue', hex: '#669BBC' },
  { id: 'storm-blue', name: 'Storm Blue', hex: '#457B9D' },
  { id: 'cobalt-glow', name: 'Cobalt Glow', hex: '#3A86FF' },
  { id: 'indigo-night', name: 'Indigo Night', hex: '#3D348B' },
  { id: 'violet-haze', name: 'Violet Haze', hex: '#7B2CBF' },
  { id: 'iris', name: 'Iris', hex: '#8E7DBE' },
  { id: 'orchid', name: 'Orchid', hex: '#C77DFF' },
  { id: 'neon-orchid', name: 'Neon Orchid', hex: '#DA70D6' },
  { id: 'rose-dust', name: 'Rose Dust', hex: '#B56576' },
  { id: 'wild-rose', name: 'Wild Rose', hex: '#E56B6F' },
  { id: 'coral-bloom', name: 'Coral Bloom', hex: '#FF6B6B' },
  { id: 'terracotta', name: 'Terracotta', hex: '#CB997E' },
  { id: 'sienna-clay', name: 'Sienna Clay', hex: '#9C6644' },
  { id: 'espresso', name: 'Espresso', hex: '#6F4E37' },
  { id: 'charcoal', name: 'Charcoal', hex: '#2B2D42' },
  { id: 'graphite', name: 'Graphite', hex: '#4A4E69' },
  { id: 'moonstone', name: 'Moonstone', hex: '#8D99AE' },
  { id: 'arctic-mint', name: 'Arctic Mint', hex: '#B8F2E6' },
  { id: 'mint-julep', name: 'Mint Julep', hex: '#CDE77F' },
  { id: 'sunlit-lemon', name: 'Sunlit Lemon', hex: '#FFE66D' },
  { id: 'apricot', name: 'Apricot', hex: '#FFB4A2' },
  { id: 'dusty-peach', name: 'Dusty Peach', hex: '#E5989B' },
  { id: 'merlot', name: 'Merlot', hex: '#6D213C' },
  { id: 'midnight-plum', name: 'Midnight Plum', hex: '#5A189A' },
] as const

export type ProjectColor = (typeof PROJECT_COLOR_PALETTE)[number]['id']

const LEGACY_PROJECT_COLOR_MAP = {
  slate: 'graphite',
  red: 'flag-red',
  orange: 'persimmon',
  amber: 'gilded-honey',
  emerald: 'lagoon',
  teal: 'verdigris',
  cyan: 'sea-glass',
  sky: 'steel-blue',
  blue: 'cobalt-glow',
  indigo: 'indigo-night',
  violet: 'violet-haze',
  purple: 'midnight-plum',
  fuchsia: 'neon-orchid',
  pink: 'wild-rose',
  rose: 'rose-dust',
} as const

export const DEFAULT_PROJECT_COLOR = PROJECT_COLOR_PALETTE[0].id

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

export interface Project {
  id: string
  name: string
  repoPath: string
  description: string
  progress: 0 | 1 | 2 | 3 // maps to ◔ ◑ ◕ ⚫
  color: ProjectColor
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
  gitWorkspacesEnabled?: boolean
}

export interface UpdateProjectInput {
  id: string
  name?: string
  description?: string
  progress?: 0 | 1 | 2 | 3
  color?: ProjectColor
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
