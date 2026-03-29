import { registerProjectHandlers } from './projects.ipc'
import { registerWorkspaceHandlers } from './workspace.ipc'
import { registerTerminalHandlers } from './terminal.ipc'
import { registerT3CodeHandlers } from './t3code.ipc'

export function registerAllHandlers(): void {
  registerProjectHandlers()
  registerWorkspaceHandlers()
  registerTerminalHandlers()
  registerT3CodeHandlers()
}
