import type * as Monaco from 'monaco-editor'

function readCssVariable(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function ensureCentipedeMonacoTheme(
  monaco: typeof Monaco,
  theme: 'light' | 'dark'
): string {
  const themeName = theme === 'dark' ? 'centipede-dark' : 'centipede-light'

  monaco.editor.defineTheme(themeName, {
    base: theme === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      {
        token: 'comment',
        foreground: theme === 'dark' ? '737373' : '6b7280'
      }
    ],
    colors: {
      'editor.background': readCssVariable(
        '--app-color-bg',
        theme === 'dark' ? '#0a0a0a' : '#fafaf9'
      ),
      'editor.foreground': readCssVariable(
        '--app-color-text-primary',
        theme === 'dark' ? '#e5e5e5' : '#171717'
      ),
      'editorLineNumber.foreground': readCssVariable(
        '--app-color-text-muted',
        theme === 'dark' ? '#737373' : '#737373'
      ),
      'editorLineNumber.activeForeground': readCssVariable(
        '--app-color-text-secondary',
        theme === 'dark' ? '#a3a3a3' : '#525252'
      ),
      'editorCursor.foreground': readCssVariable(
        '--app-color-accent',
        theme === 'dark' ? '#3b82f6' : '#2563eb'
      ),
      'editor.selectionBackground': theme === 'dark' ? '#1d4ed866' : '#93c5fd66',
      'editor.inactiveSelectionBackground': theme === 'dark' ? '#1f293766' : '#d4d4d866',
      'editorIndentGuide.background1': theme === 'dark' ? '#202020' : '#e5e5e5',
      'editorIndentGuide.activeBackground1': theme === 'dark' ? '#2a2a2a' : '#d4d4d4',
      'editorWidget.background': readCssVariable(
        '--app-color-bg-raised',
        theme === 'dark' ? '#141414' : '#f2f2f1'
      ),
      'editorWidget.border': readCssVariable(
        '--app-color-border',
        theme === 'dark' ? '#2a2a2a' : '#d4d4d4'
      )
    }
  })

  return themeName
}
