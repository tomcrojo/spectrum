import { AppShell } from '@renderer/components/layout/AppShell'
import { StyleLabPage } from '@renderer/components/style-lab/StyleLabPage'
import { useBrowserApiListener } from '@renderer/hooks/useBrowserApiListener'
import { useBrowserCliSessionSync } from '@renderer/hooks/useBrowserCliSessionSync'
import { useProjectResidency } from '@renderer/hooks/useProjectResidency'

export default function App() {
  useBrowserApiListener()
  useBrowserCliSessionSync()
  useProjectResidency()

  if (typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search)

    if (searchParams.has('style-lab')) {
      return <StyleLabPage />
    }
  }

  return <AppShell />
}
