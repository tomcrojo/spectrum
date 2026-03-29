import { AppShell } from '@renderer/components/layout/AppShell'
import { useBrowserApiListener } from '@renderer/hooks/useBrowserApiListener'

export default function App() {
  useBrowserApiListener()
  return <AppShell />
}
