import { useEffect, useMemo, useRef, useState } from 'react'
import { t3codeApi } from '@renderer/lib/ipc'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

interface T3CodePanelProps {
  panelId: string
  workspaceId: string
  projectId: string
  projectName: string
  projectPath: string
  t3ProjectId?: string
  t3ThreadId?: string
  theme: 'light' | 'dark'
  autoFocus: boolean
}

interface ThreadBinding {
  baseUrl: string
  t3ProjectId: string
  t3ThreadId: string
}

interface ThreadInfo {
  url: string | null
  threadTitle: string | null
  lastUserMessageAt: string | null
}

export function T3CodePanel({
  panelId,
  workspaceId,
  projectId,
  projectName,
  projectPath,
  t3ProjectId,
  t3ThreadId,
  theme,
  autoFocus
}: T3CodePanelProps) {
  const updatePanel = useWorkspacesStore((state) => state.updatePanel)
  const updateWorkspaceLastPanelEditedAt = useWorkspacesStore(
    (state) => state.updateWorkspaceLastPanelEditedAt
  )
  const [binding, setBinding] = useState<ThreadBinding | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!t3ProjectId || !t3ThreadId) {
      return
    }

    setBinding((current) =>
      current?.t3ProjectId === t3ProjectId && current.t3ThreadId === t3ThreadId
        ? current
        : current
          ? { ...current, t3ProjectId, t3ThreadId }
          : null
    )
  }, [t3ProjectId, t3ThreadId])

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

    const applyThreadInfo = (threadInfo: ThreadInfo) => {
      if (cancelled) return

      if (threadInfo.threadTitle?.trim()) {
        updatePanel(panelId, { panelTitle: threadInfo.threadTitle.trim() })
      }
      if (threadInfo.lastUserMessageAt) {
        void updateWorkspaceLastPanelEditedAt(workspaceId, threadInfo.lastUserMessageAt)
      }
    }

    t3codeApi
      .ensurePanelThread({
        panelId,
        centipedeProjectId: projectId,
        projectPath,
        projectName,
        existingT3ProjectId: t3ProjectId,
        existingT3ThreadId: t3ThreadId
      })
      .then((runtime) => {
        if (cancelled) {
          return
        }

        setBinding({
          baseUrl: runtime.baseUrl,
          t3ProjectId: runtime.t3ProjectId,
          t3ThreadId: runtime.t3ThreadId
        })
        setIframeUrl(null)
        setError(null)

        if (
          runtime.t3ProjectId !== t3ProjectId ||
          runtime.t3ThreadId !== t3ThreadId ||
          runtime.threadTitle?.trim()
        ) {
          updatePanel(panelId, {
            t3ProjectId: runtime.t3ProjectId,
            t3ThreadId: runtime.t3ThreadId,
            panelTitle: runtime.threadTitle?.trim() || undefined
          })
        }

        applyThreadInfo(runtime)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    panelId,
    projectId,
    projectName,
    projectPath,
    t3ProjectId,
    t3ThreadId,
    updatePanel,
    updateWorkspaceLastPanelEditedAt,
    workspaceId
  ])

  useEffect(() => {
    if (!binding?.t3ThreadId) {
      return
    }

    let cancelled = false

    const poll = () => {
      t3codeApi
        .getThreadInfo(binding.t3ThreadId)
        .then((threadInfo) => {
          if (cancelled) {
            return
          }

          if (threadInfo.threadTitle?.trim()) {
            updatePanel(panelId, { panelTitle: threadInfo.threadTitle.trim() })
          }
          if (threadInfo.lastUserMessageAt) {
            void updateWorkspaceLastPanelEditedAt(workspaceId, threadInfo.lastUserMessageAt)
          }
        })
        .catch(() => {})
    }

    poll()
    const pollId = window.setInterval(poll, 2000)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
    }
  }, [binding?.t3ThreadId, panelId, updatePanel, updateWorkspaceLastPanelEditedAt, workspaceId])

  const themedUrl = useMemo(() => {
    if (!binding?.baseUrl || !binding.t3ThreadId) {
      return null
    }

    const url = new URL(`/embed/thread/${binding.t3ThreadId}`, `${binding.baseUrl}/`)
    url.searchParams.set('embedded', '1')
    url.searchParams.set('centipedeTheme', theme)
    return url.toString()
  }, [binding, theme])

  useEffect(() => {
    if (!themedUrl || !binding?.baseUrl) {
      setIframeUrl(null)
      return
    }

    let cancelled = false

    const waitForBrowserReachability = async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          await fetch(binding.baseUrl, {
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
  }, [binding?.baseUrl, themedUrl])

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
          <p className="mb-2 text-sm text-red-400">Failed to start T3Code</p>
          <p className="text-xs text-text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!binding || !iframeUrl) {
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
