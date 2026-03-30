import { registerProjectHandlers } from './projects.ipc'
import { registerWorkspaceHandlers } from './workspace.ipc'
import { registerTerminalHandlers } from './terminal.ipc'
import { registerT3CodeHandlers } from './t3code.ipc'
import { registerBrowserHandlers } from './browser.ipc'
import { registerFileHandlers } from './files.ipc'

export function registerAllHandlers(): void {
  registerProjectHandlers()
  registerWorkspaceHandlers()
  registerTerminalHandlers()
  registerT3CodeHandlers()
  registerBrowserHandlers()
  registerFileHandlers()
}
