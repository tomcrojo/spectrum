import { app } from 'electron'
import { homedir } from 'os'
import { delimiter, join } from 'path'

function getProjectRoot(): string {
  if (typeof app?.getAppPath === 'function') {
    return app.getAppPath()
  }

  return process.cwd()
}

function getUserDataPath(): string {
  if (typeof app?.getPath === 'function') {
    return app.getPath('userData')
  }

  return join(homedir(), '.centipede-dev')
}

export function getBrowserCliRoot(): string {
  return join(getProjectRoot(), 'resources', 'browser-cli')
}

export function getBrowserCliBinDir(): string {
  return join(getBrowserCliRoot(), 'bin')
}

export function getBrowserCliSessionFilePath(): string {
  return join(getUserDataPath(), 'browser-cli', 'sessions.json')
}

export function prependBrowserCliToPath(existingPath: string | undefined): string {
  const binDir = getBrowserCliBinDir()
  if (!existingPath) {
    return binDir
  }

  return [binDir, ...existingPath.split(delimiter).filter(Boolean)].join(delimiter)
}
