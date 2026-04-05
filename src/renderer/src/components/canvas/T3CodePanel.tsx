import { useEffect, useMemo, useRef, useState } from 'react'
import { t3codeApi } from '@renderer/lib/ipc'
import { openFileInWorkspace } from '@renderer/lib/open-file'
import { incrementDevMountCount } from '@renderer/lib/dev-performance'
import { suggestT3CodeTitleFromPrompt } from '@renderer/lib/t3code-auto-title'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'
import { useUiStore } from '@renderer/stores/ui.store'
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
  providerId: string | null
  activityState:
    | 'starting'
    | 'connecting'
    | 'running'
    | 'requires-input'
    | 'completed'
    | 'idle'
    | 'unknown'
}

function isOpenFileMessage(
  value: unknown
): value is {
  type: 'spectrum:open-file'
  payload: {
    path: string
    line?: number
    column?: number
  }
} {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as {
    type?: unknown
    payload?: { path?: unknown; line?: unknown; column?: unknown }
  }

  return (
    candidate.type === 'spectrum:open-file' &&
    typeof candidate.payload?.path === 'string' &&
    (candidate.payload.line === undefined || typeof candidate.payload.line === 'number') &&
    (candidate.payload.column === undefined || typeof candidate.payload.column === 'number')
  )
}

function isFirstUserMessageEvent(
  value: unknown
): value is {
  type: 'spectrum:first-user-message'
  payload: {
    text: string
  }
} {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as {
    type?: unknown
    payload?: { text?: unknown }
  }

  return candidate.type === 'spectrum:first-user-message' && typeof candidate.payload?.text === 'string'
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
  hydrationState
}: T3CodePanelProps) {
  const updatePanelLayout = useWorkspacesStore((state) => state.updatePanelLayout)
  const applyAutoTitleToT3CodePanel = useWorkspacesStore((state) => state.applyAutoTitleToT3CodePanel)
  const updateWorkspaceLastPanelEditedAt = useWorkspacesStore(
    (state) => state.updateWorkspaceLastPanelEditedAt
  )
  const focusedPanelId = useWorkspacesStore((state) => state.focusedPanelId)
  const followUpBehavior = useUiStore((state) => state.followUpBehavior)
  const assistantStreaming = useUiStore((state) => state.assistantStreaming)
  const updatePanelRuntime = usePanelRuntimeStore((state) => state.updatePanelRuntime)
  const setPanelFailure = usePanelRuntimeStore((state) => state.setPanelFailure)
  const [binding, setBinding] = useState<ThreadBinding | null>(null)
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

    const applyThreadInfo = (threadInfo: Omit<ThreadInfo, 'url'>) => {
      if (cancelled) {
        return
      }

      if (threadInfo.providerId) {
        updatePanelLayout(panelId, { providerId: threadInfo.providerId })
      }
      if (threadInfo.lastUserMessageAt) {
        updatePanelRuntime(panelId, {
          t3ThreadTitle: threadInfo.threadTitle,
          t3LastUserMessageAt: threadInfo.lastUserMessageAt,
          t3ActivityState: threadInfo.activityState
        })
        void updateWorkspaceLastPanelEditedAt(workspaceId, threadInfo.lastUserMessageAt)
      } else {
        updatePanelRuntime(panelId, {
          t3ThreadTitle: threadInfo.threadTitle,
          t3ActivityState: threadInfo.activityState
        })
      }
    }

    t3codeApi
      .ensurePanelThread({
        panelId,
        workspaceId,
        spectrumProjectId: projectId,
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

        if (
          runtime.t3ProjectId !== t3ProjectId ||
          runtime.t3ThreadId !== t3ThreadId ||
          runtime.providerId
        ) {
          updatePanelLayout(panelId, {
            t3ProjectId: runtime.t3ProjectId,
            t3ThreadId: runtime.t3ThreadId,
            providerId: runtime.providerId ?? undefined
          })
        }

        applyThreadInfo(runtime)
      })
      .catch((nextError: Error) => {
        if (!cancelled) {
          setPanelFailure(panelId, {
            source: 'async-init',
            summary: 'The embedded T3Code panel failed to start.',
            debug: nextError.stack ?? nextError.message,
            occurredAt: Date.now()
          })
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
    setPanelFailure,
    t3ProjectId,
    t3ThreadId,
    updatePanelLayout,
    updatePanelRuntime,
    updateWorkspaceLastPanelEditedAt,
    workspaceId
  ])

  // Acknowledge (clear) notification when panel gets focused
  useEffect(() => {
    if (focusedPanelId !== panelId) {
      return
    }

    const runtime = usePanelRuntimeStore.getState().panelRuntimeById[panelId]
    if (runtime?.t3NotificationKind) {
      updatePanelRuntime(panelId, {
        t3NotificationAcknowledgedAt: new Date().toISOString()
      })
    }
  }, [focusedPanelId, panelId, updatePanelRuntime])

  const postTheme = () => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'spectrum:set-theme',
        theme
      },
      '*'
    )
  }

  const postClientSettings = () => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'spectrum:set-client-settings',
        settings: {
          followUpBehavior,
          assistantStreaming
        }
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
    url.searchParams.set('spectrumTheme', theme)
    url.searchParams.set('spectrumFollowUpBehavior', followUpBehavior)
    url.searchParams.set('spectrumAssistantStreaming', assistantStreaming ? '1' : '0')
    return url.toString()
  }, [assistantStreaming, binding, followUpBehavior, theme])

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
        setPanelFailure(panelId, {
          source: 'async-init',
          summary: 'The embedded T3Code app did not become reachable in time.',
          debug: `Base URL: ${binding.baseUrl}`,
          occurredAt: Date.now()
        })
      }
    }

    void waitForBrowserReachability()

    return () => {
      cancelled = true
    }
  }, [binding?.baseUrl, hydrationState, panelId, setPanelFailure, themedUrl])

  useEffect(() => {
    postTheme()
  }, [theme, iframeUrl])

  useEffect(() => {
    postClientSettings()
  }, [assistantStreaming, followUpBehavior, iframeUrl])

  useEffect(() => {
    if (!binding?.baseUrl) {
      return
    }

    const allowedOrigin = new URL(binding.baseUrl).origin

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== allowedOrigin) {
        return
      }

      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      if (isFirstUserMessageEvent(event.data)) {
        const nextTitle = suggestT3CodeTitleFromPrompt(event.data.payload.text)
        if (nextTitle) {
          void applyAutoTitleToT3CodePanel(panelId, nextTitle)
        }
        return
      }

      if (!isOpenFileMessage(event.data)) {
        return
      }

      void openFileInWorkspace({
        projectId,
        workspaceId,
        path: event.data.payload.path,
        line: event.data.payload.line,
        column: event.data.payload.column,
        source: 't3code'
      })
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [applyAutoTitleToT3CodePanel, binding?.baseUrl, panelId, projectId, workspaceId])

  useEffect(() => {
    if (!autoFocus || !iframeUrl || hydrationState !== 'live') {
      return
    }

    requestAnimationFrame(() => {
      iframeRef.current?.focus({ preventScroll: true })
    })
  }, [autoFocus, hydrationState, iframeUrl])

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
      onLoad={() => {
        postTheme()
        postClientSettings()
      }}
      title={`T3Code ${panelId}`}
      className="h-full w-full border-0 bg-bg"
      allow="clipboard-read; clipboard-write"
    />
  )
}
