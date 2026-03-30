import { AppShell } from '@renderer/components/layout/AppShell'
import { useBrowserApiListener } from '@renderer/hooks/useBrowserApiListener'
import { useBrowserCliSessionSync } from '@renderer/hooks/useBrowserCliSessionSync'

export default function App() {
  useBrowserApiListener()
  useBrowserCliSessionSync()
  return <AppShell />
}
