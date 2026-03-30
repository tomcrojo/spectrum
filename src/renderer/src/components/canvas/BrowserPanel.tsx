import { useEffect, useMemo, useRef, useState } from 'react'
import { browserApi } from '@renderer/lib/ipc'
import { incrementDevMountCount } from '@renderer/lib/dev-performance'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

interface BrowserPanelProps {
  panelId: string
  workspaceId: string
  projectId: string
  initialUrl?: string
  autoFocus: boolean
  isResizing: boolean
  hydrationState: 'live' | 'preview' | 'cold'
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return 'about:blank'
  }
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

export function BrowserPanel({
  panelId,
  workspaceId,
  projectId,
  initialUrl,
  autoFocus,
  isResizing
}: BrowserPanelProps) {
  const updatePanelLayout = useWorkspacesStore((state) => state.updatePanelLayout)
  const isElectron = typeof window !== 'undefined' && typeof window.api !== 'undefined'
  const webviewRef = useRef<HTMLWebViewElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const webContentsIdRef = useRef<number | null>(null)
  const [currentUrl, setCurrentUrl] = useState(() =>
    normalizeUrl(initialUrl ?? 'https://localhost:3000')
  )
  const [inputValue, setInputValue] = useState(() =>
    normalizeUrl(initialUrl ?? 'https://localhost:3000')
  )
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  useEffect(() => {
    incrementDevMountCount('BrowserPanel')
  }, [])

  useEffect(() => {
    updatePanelLayout(panelId, { url: currentUrl })
    browserApi
      .urlChanged({
        panelId,
        url: currentUrl
      })
      .catch(() => {})
  }, [currentUrl, panelId, updatePanelLayout])

  useEffect(() => {
    if (!autoFocus) {
      return
    }

    requestAnimationFrame(() => {
      if (isElectron) {
        webviewRef.current?.focus()
      } else {
        iframeRef.current?.focus()
      }
    })
  }, [autoFocus, isElectron])

  useEffect(() => {
    if (!isElectron) {
      return
    }

    const webview = webviewRef.current
    if (!webview) {
      return
    }

    const handleDidStartLoading = () => {
      setLoadError(null)
      setIsLoading(true)
    }

    const handleDidStopLoading = () => {
      setIsLoading(false)
      setCanGoBack(webview.canGoBack())
      setCanGoForward(webview.canGoForward())
    }

    const handleDidNavigate = (event: { url: string }) => {
      setCurrentUrl(event.url)
      setInputValue(event.url)
    }

    const handleFailLoad = (event: {
      errorCode: number
      errorDescription: string
      validatedURL: string
    }) => {
      if (event.errorCode === -3) {
        return
      }
      setLoadError(
        `Failed to load ${event.validatedURL} (${event.errorCode}): ${event.errorDescription}`
      )
    }

    const handleTitleUpdated = (event: { title: string }) => {
      const nextTitle = event.title.trim()
      if (!nextTitle) {
        return
      }

      updatePanelLayout(panelId, { panelTitle: nextTitle })
      browserApi
        .urlChanged({
          panelId,
          panelTitle: nextTitle
        })
        .catch(() => {})
    }

    const handleDomReady = () => {
      const webContentsId = webview.getWebContentsId()
      webContentsIdRef.current = webContentsId
      browserApi
        .webviewReady({
          panelId,
          workspaceId,
          projectId,
          webContentsId
        })
        .catch(() => {})
    }

    const handleNewWindow = (event: { url: string; preventDefault: () => void }) => {
      event.preventDefault()
      const nextUrl = normalizeUrl(event.url)
      setCurrentUrl(nextUrl)
      setInputValue(nextUrl)
      webview.loadURL(nextUrl)
    }

    webview.addEventListener('did-start-loading', handleDidStartLoading as any)
    webview.addEventListener('did-stop-loading', handleDidStopLoading as any)
    webview.addEventListener('did-navigate', handleDidNavigate as any)
    webview.addEventListener('did-navigate-in-page', handleDidNavigate as any)
    webview.addEventListener('did-fail-load', handleFailLoad as any)
    webview.addEventListener('page-title-updated', handleTitleUpdated as any)
    webview.addEventListener('dom-ready', handleDomReady as any)
    webview.addEventListener('new-window', handleNewWindow as any)

    return () => {
      webview.removeEventListener('did-start-loading', handleDidStartLoading as any)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading as any)
      webview.removeEventListener('did-navigate', handleDidNavigate as any)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate as any)
      webview.removeEventListener('did-fail-load', handleFailLoad as any)
      webview.removeEventListener('page-title-updated', handleTitleUpdated as any)
      webview.removeEventListener('dom-ready', handleDomReady as any)
      webview.removeEventListener('new-window', handleNewWindow as any)
      browserApi
        .webviewDestroyed({
          panelId,
          workspaceId,
          projectId,
          webContentsId: webContentsIdRef.current ?? undefined
        })
        .catch(() => {})
    }
  }, [isElectron, panelId, projectId, updatePanelLayout, workspaceId])

  const warningBadge = useMemo(() => {
    if (isElectron) {
      return null
    }

    return (
      <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
        Session isolation unavailable
      </span>
    )
  }, [isElectron])

  const navigateToInput = () => {
    const nextUrl = normalizeUrl(inputValue)
    setLoadError(null)
    setCurrentUrl(nextUrl)
    setInputValue(nextUrl)
    if (isElectron) {
      webviewRef.current?.loadURL(nextUrl)
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <div className="relative flex h-7 items-center gap-2 border-b border-border-subtle bg-bg-raised px-2">
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
          title={isLoading ? 'Stop' : 'Reload'}
          onClick={() => {
            if (isElectron) {
              if (isLoading) {
                webviewRef.current?.stop()
              } else {
                webviewRef.current?.reload()
              }
              return
            }

            if (!isLoading) {
              setCurrentUrl((prev) => `${prev}`)
            }
          }}
        >
          {isLoading ? 'x' : 'r'}
        </button>

        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
          title="Back"
          disabled={!canGoBack}
          onClick={() => {
            if (isElectron && webviewRef.current?.canGoBack()) {
              webviewRef.current.goBack()
            }
          }}
        >
          {'<'}
        </button>

        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary disabled:opacity-40"
          title="Forward"
          disabled={!canGoForward}
          onClick={() => {
            if (isElectron && webviewRef.current?.canGoForward()) {
              webviewRef.current.goForward()
            }
          }}
        >
          {'>'}
        </button>

        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              navigateToInput()
            }
          }}
          className="min-w-0 flex-1 rounded bg-bg px-2 py-1 text-xs text-text-primary outline-none ring-1 ring-transparent transition focus:ring-accent/40"
          spellCheck={false}
        />

        {warningBadge}
      </div>

      <div className="relative min-h-0 flex-1">
        {isElectron ? (
          <webview
            ref={webviewRef}
            src={currentUrl}
            className="h-full w-full"
            allowpopups="true"
            webpreferences="contextIsolation=yes"
            style={{ opacity: isResizing ? 0.85 : 1 }}
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            title={`Browser ${panelId}`}
            className="h-full w-full border-0"
          />
        )}
      </div>

      {loadError ? (
        <div className="border-t border-border-subtle bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          {loadError}
        </div>
      ) : null}
    </div>
  )
}
