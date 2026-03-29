import { app } from 'electron'
import { delimiter, join } from 'path'

function getProjectRoot(): string {
  return app.getAppPath()
}

export function getYellowRoot(): string {
  return join(getProjectRoot(), 'resources', 'yellow')
}

export function getYellowBinDir(): string {
  return join(getYellowRoot(), 'bin')
}

export function getYellowSessionFilePath(): string {
  return join(app.getPath('userData'), 'browser-cli', 'sessions.json')
}

export function prependYellowToPath(existingPath: string | undefined): string {
  const binDir = getYellowBinDir()
  if (!existingPath) {
    return binDir
  }

  return [binDir, ...existingPath.split(delimiter).filter(Boolean)].join(delimiter)
}
