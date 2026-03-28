import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { homedir } from 'os'

interface PtyInstance {
  pty: pty.IPty
  projectId: string
  workspaceId: string
}

const ptys = new Map<string, PtyInstance>()

function getShell(): string {
  if (process.platform === 'win32') return 'powershell.exe'
  return process.env.SHELL || '/bin/zsh'
}

export function createPty(
  id: string,
  cwd: string,
  projectId: string,
  workspaceId: string,
  window: BrowserWindow
): { id: string; pid: number } {
  const shell = getShell()

  // Validate cwd exists, fallback to home directory
  const safeCwd = existsSync(cwd) ? cwd : homedir()

  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor'
  }
  // Unset ELECTRON_RUN_AS_NODE so child shells behave normally
  delete env.ELECTRON_RUN_AS_NODE

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: safeCwd,
    env: env as Record<string, string>
  })

  // Stream data from PTY to renderer
  ptyProcess.onData((data) => {
    if (!window.isDestroyed()) {
      window.webContents.send(`terminal:data:${id}`, data)
    }
  })

  ptyProcess.onExit(({ exitCode }) => {
    if (!window.isDestroyed()) {
      window.webContents.send(`terminal:exit:${id}`, exitCode)
    }
    ptys.delete(id)
  })

  ptys.set(id, { pty: ptyProcess, projectId, workspaceId })

  return { id, pid: ptyProcess.pid }
}

export function writePty(id: string, data: string): void {
  const instance = ptys.get(id)
  if (instance) {
    instance.pty.write(data)
  }
}

export function resizePty(id: string, cols: number, rows: number): void {
  const instance = ptys.get(id)
  if (instance) {
    instance.pty.resize(cols, rows)
  }
}

export function closePty(id: string): void {
  const instance = ptys.get(id)
  if (instance) {
    instance.pty.kill()
    ptys.delete(id)
  }
}

export function closeAllPtys(): void {
  for (const [id, instance] of ptys) {
    instance.pty.kill()
    ptys.delete(id)
  }
}

export function getPtyIds(): string[] {
  return Array.from(ptys.keys())
}
