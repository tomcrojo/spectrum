import { useEffect, useMemo, useRef, useState } from 'react'
import { T3CODE_CHANNELS } from '@shared/ipc-channels'
import { t3codeApi } from '@renderer/lib/ipc'
import { transport } from '@renderer/lib/transport'
import { incrementDevMountCount } from '@renderer/lib/dev-performance'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
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
  hydrationState: 'live' | 'cold'
  watchPriority: 'focused' | 'active' | 'inactive'
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

function T3CodeShell({
  label,
  threadTitle,
  lastUserMessageAt
}: {
  label: string
  threadTitle?: string | null
  lastUserMessageAt?: string | null
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_50%),linear-gradient(180deg,_rgba(20,20,20,0.98),_rgba(10,10,10,1))] px-6">
      <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-raised/70 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
        <p className="text-sm font-medium text-text-primary">{threadTitle?.trim() || label}</p>
        <p className="mt-1 text-xs text-text-secondary">Background thread still running</p>
        <p className="mt-3 text-xs leading-5 text-text-muted">
          The conversation is parked to reduce UI cost. Return focus to re-open the live thread view instantly.
        </p>
        {lastUserMessageAt ? (
          <p className="mt-3 text-[11px] uppercase tracking-wide text-text-muted">
            Last activity {new Date(lastUserMessageAt).toLocaleString()}
          </p>
        ) : null}
      </div>
    </div>
  )
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
  autoFocus,
  hydrationState,
  watchPriority
}: T3CodePanelProps) {
  const updatePanelLayout = useWorkspacesStore((state) => state.updatePanelLayout)
  const updateWorkspaceLastPanelEditedAt = useWorkspacesStore(
    (state) => state.updateWorkspaceLastPanelEditedAt
  )
  const updatePanelRuntime = usePanelRuntimeStore((state) => state.updatePanelRuntime)
  const [binding, setBinding] = useState<ThreadBinding | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const parkedThreadTitle = usePanelRuntimeStore((state) => state.panelRuntimeById[panelId]?.t3ThreadTitle)
  const parkedLastUserMessageAt = usePanelRuntimeStore(
    (state) => state.panelRuntimeById[panelId]?.t3LastUserMessageAt
  )

  useEffect(() => {
    incrementDevMountCount('T3CodePanel')
  }, [])

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

  useEffect(() => {
    if (hydrationState !== 'live') {
      setIframeUrl(null)
      return
    }

    let cancelled = false

    const applyThreadInfo = (threadInfo: ThreadInfo) => {
      if (cancelled) {
        return
      }

      if (threadInfo.threadTitle?.trim()) {
        updatePanelLayout(panelId, { panelTitle: threadInfo.threadTitle.trim() })
      }
      if (threadInfo.lastUserMessageAt) {
        updatePanelRuntime(panelId, {
          t3ThreadTitle: threadInfo.threadTitle,
          t3LastUserMessageAt: threadInfo.lastUserMessageAt
        })
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
        setError(null)

        if (
          runtime.t3ProjectId !== t3ProjectId ||
          runtime.t3ThreadId !== t3ThreadId ||
          runtime.threadTitle?.trim()
        ) {
          updatePanelLayout(panelId, {
            t3ProjectId: runtime.t3ProjectId,
            t3ThreadId: runtime.t3ThreadId,
            panelTitle: runtime.threadTitle?.trim() || undefined
          })
        }

        applyThreadInfo(runtime)
      })
      .catch((nextError: Error) => {
        if (!cancelled) {
          setError(nextError.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    hydrationState,
    panelId,
    projectId,
    projectName,
    projectPath,
    t3ProjectId,
    t3ThreadId,
    updatePanelLayout,
    updatePanelRuntime,
    updateWorkspaceLastPanelEditedAt,
    workspaceId
  ])

  useEffect(() => {
    const watchedThreadId = binding?.t3ThreadId ?? t3ThreadId
    if (!watchedThreadId) {
      return
    }

    t3codeApi
      .watchThread({
        panelId,
        t3ThreadId: watchedThreadId,
        priority: watchPriority
      })
      .catch(() => {})

    return () => {
      t3codeApi.unwatchThread(panelId).catch(() => {})
    }
  }, [binding?.t3ThreadId, panelId, t3ThreadId, watchPriority])

  useEffect(() => {
    const remove = transport.on(
      T3CODE_CHANNELS.THREAD_INFO_CHANGED,
      (payload: {
        panelId: string
        t3ThreadId: string
        threadTitle: string | null
        lastUserMessageAt: string | null
      }) => {
        if (payload.panelId !== panelId) {
          return
        }

        if (payload.threadTitle?.trim()) {
          updatePanelLayout(panelId, { panelTitle: payload.threadTitle.trim() })
        }
        updatePanelRuntime(panelId, {
          t3ThreadTitle: payload.threadTitle,
          t3LastUserMessageAt: payload.lastUserMessageAt
        })
        if (payload.lastUserMessageAt) {
          void updateWorkspaceLastPanelEditedAt(workspaceId, payload.lastUserMessageAt)
        }
      }
    )

    return remove
  }, [panelId, updatePanelLayout, updatePanelRuntime, updateWorkspaceLastPanelEditedAt, workspaceId])

  const postTheme = () => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'centipede:set-theme',
        theme
      },
      '*'
    )
  }

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
    if (hydrationState !== 'live' || !themedUrl || !binding?.baseUrl) {
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
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      if (!cancelled) {
        setError('Timed out waiting for the embedded T3Code app to become reachable')
      }
    }

    void waitForBrowserReachability()

    return () => {
      cancelled = true
    }
  }, [binding?.baseUrl, hydrationState, themedUrl])

  useEffect(() => {
    postTheme()
  }, [theme, iframeUrl])

  useEffect(() => {
    if (!autoFocus || !iframeUrl || hydrationState !== 'live') {
      return
    }

    requestAnimationFrame(() => {
      iframeRef.current?.focus({ preventScroll: true })
    })
  }, [autoFocus, hydrationState, iframeUrl])

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

  if (hydrationState !== 'live') {
    return (
      <T3CodeShell
        label="T3Code parked"
        threadTitle={parkedThreadTitle}
        lastUserMessageAt={parkedLastUserMessageAt}
      />
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
      title={`T3Code ${panelId}`}
      className="h-full w-full border-0 bg-bg"
      allow="clipboard-read; clipboard-write"
    />
  )
}
