import { useSyncExternalStore } from 'react'
import { useUiStore, type UiTheme } from '@renderer/stores/ui.store'

function getSystemThemeSnapshot(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function subscribeToSystemTheme(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', listener)

  return () => {
    mediaQuery.removeEventListener('change', listener)
  }
}

export function resolveTheme(theme: UiTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme
  }

  if (typeof window === 'undefined') {
    return 'dark'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useUiStore((state) => state.theme)

  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeSnapshot
  )

  return theme === 'system' ? systemTheme : theme
}
