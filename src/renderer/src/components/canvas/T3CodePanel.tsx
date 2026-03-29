import { useEffect, useMemo, useRef, useState } from 'react'
import { t3codeApi } from '@renderer/lib/ipc'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

interface T3CodePanelProps {
  panelId: string
  workspaceId: string
  projectPath: string
  theme: 'light' | 'dark'
  autoFocus: boolean
}

export function T3CodePanel({
  panelId,
  workspaceId,
  projectPath,
  theme,
  autoFocus
}: T3CodePanelProps) {
  const updatePanel = useWorkspacesStore((state) => state.updatePanel)
  const updateWorkspaceLastPanelEditedAt = useWorkspacesStore(
    (state) => state.updateWorkspaceLastPanelEditedAt
  )
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const postTheme = () => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'centipede:set-theme',
        theme
      },
      '*'
    )
  }

  useEffect(() => {
    let cancelled = false

    const applyThreadInfo = (threadInfo: {
      url: string | null
      threadTitle: string | null
      lastUserMessageAt: string | null
    }) => {
      if (cancelled) return
      if (threadInfo.url) {
        setUrl(threadInfo.url)
      }
      if (threadInfo.threadTitle?.trim()) {
        updatePanel(panelId, { panelTitle: threadInfo.threadTitle.trim() })
      }
      if (threadInfo.lastUserMessageAt) {
        void updateWorkspaceLastPanelEditedAt(workspaceId, threadInfo.lastUserMessageAt)
      }
    }

    t3codeApi
      .start(panelId, projectPath)
      .then((runtime) => {
        if (!cancelled) {
          setUrl(runtime.url)
          setIframeUrl(null)
          setError(null)
          applyThreadInfo(runtime)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
        }
      })

    const pollId = window.setInterval(() => {
      t3codeApi
        .getThreadInfo(panelId, projectPath)
        .then(applyThreadInfo)
        .catch(() => {})
    }, 2000)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      t3codeApi.stop(panelId).catch(() => {})
    }
  }, [panelId, projectPath, updatePanel, updateWorkspaceLastPanelEditedAt, workspaceId])

  const themedUrl = useMemo(() => {
    if (!url) {
      return null
    }

    const iframeUrl = new URL(url)
    iframeUrl.searchParams.set('centipedeTheme', theme)
    return iframeUrl.toString()
  }, [url, theme])

  useEffect(() => {
    if (!themedUrl) {
      setIframeUrl(null)
      return
    }

    let cancelled = false

    const waitForBrowserReachability = async () => {
      const probeUrl = new URL(themedUrl)
      probeUrl.search = ''
      probeUrl.hash = ''

      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          await fetch(probeUrl.toString(), {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
            mode: 'no-cors'
          })

          if (!cancelled) {
            setIframeUrl(themedUrl)
          }

          return
        } catch {
          // retry
        }

        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      if (!cancelled) {
        setError('Timed out waiting for the embedded T3Code app to become reachable')
      }
    }

    void waitForBrowserReachability()

    return () => {
      cancelled = true
    }
  }, [themedUrl])

  useEffect(() => {
    postTheme()
  }, [theme, iframeUrl])

  useEffect(() => {
    if (!autoFocus || !iframeUrl) return

    requestAnimationFrame(() => {
      iframeRef.current?.focus({ preventScroll: true })
    })
  }, [autoFocus, iframeUrl])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm text-red-400 mb-2">Failed to start T3Code</p>
          <p className="text-xs text-text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!url || !iframeUrl) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">Starting T3Code…</p>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      src={iframeUrl}
      title="T3Code"
      className="h-full w-full border-0 bg-bg"
      onLoad={postTheme}
      tabIndex={-1}
    />
  )
}
