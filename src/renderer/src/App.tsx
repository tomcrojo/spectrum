import { AppShell } from '@renderer/components/layout/AppShell'
import { useBrowserApiListener } from '@renderer/hooks/useBrowserApiListener'
import { useYellowSessionSync } from '@renderer/hooks/useYellowSessionSync'

export default function App() {
  useBrowserApiListener()
  useYellowSessionSync()
  return <AppShell />
}
