import { registerProjectHandlers } from './projects.ipc'
import { registerWorkspaceHandlers } from './workspace.ipc'
import { registerTerminalHandlers } from './terminal.ipc'

export function registerAllHandlers(): void {
  registerProjectHandlers()
  registerWorkspaceHandlers()
  registerTerminalHandlers()
}
