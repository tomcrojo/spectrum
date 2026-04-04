import { AppShell } from '@renderer/components/layout/AppShell'
import { StyleLabPage } from '@renderer/components/style-lab/StyleLabPage'
import { useBrowserApiListener } from '@renderer/hooks/useBrowserApiListener'
import { useBrowserCliSessionSync } from '@renderer/hooks/useBrowserCliSessionSync'

export default function App() {
  useBrowserApiListener()
  useBrowserCliSessionSync()

  if (typeof window !== 'undefined') {
    const searchParams = new URLSearchParams(window.location.search)

    if (searchParams.has('style-lab')) {
      return <StyleLabPage />
    }
  }

  return <AppShell />
}
