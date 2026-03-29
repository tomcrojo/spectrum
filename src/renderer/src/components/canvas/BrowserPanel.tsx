import { useEffect, useMemo, useRef, useState } from 'react'
import { browserApi } from '@renderer/lib/ipc'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'

interface BrowserPanelProps {
  panelId: string
  workspaceId: string
  projectId: string
  initialUrl?: string
  autoFocus: boolean
  isResizing: boolean
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
  const updatePanel = useWorkspacesStore((state) => state.updatePanel)
  const isElectron = typeof window !== 'undefined' && typeof window.api !== 'undefined'
  const webviewRef = useRef<HTMLWebViewElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const webContentsIdRef = useRef<number | null>(null)
  const [currentUrl, setCurrentUrl] = useState(() => normalizeUrl(initialUrl ?? 'https://localhost:3000'))
  const [inputValue, setInputValue] = useState(() => normalizeUrl(initialUrl ?? 'https://localhost:3000'))
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  useEffect(() => {
    updatePanel(panelId, { url: currentUrl })
    browserApi.urlChanged({
      panelId,
      url: currentUrl
    }).catch(() => {})
  }, [currentUrl, panelId, updatePanel])

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

      updatePanel(panelId, { panelTitle: nextTitle })
      browserApi.urlChanged({
        panelId,
        panelTitle: nextTitle
      }).catch(() => {})
    }

    const handleDomReady = () => {
      const webContentsId = webview.getWebContentsId()
      webContentsIdRef.current = webContentsId
      browserApi.webviewReady({
        panelId,
        workspaceId,
        projectId,
        webContentsId
      }).catch(() => {})
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
      browserApi.webviewDestroyed({
        panelId,
        workspaceId,
        projectId,
        webContentsId: webContentsIdRef.current ?? undefined
      }).catch(() => {})
    }
  }, [isElectron, panelId, projectId, updatePanel, workspaceId])

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
              event.preventDefault()
              navigateToInput()
            } else if (event.key === 'Escape') {
              setInputValue(currentUrl)
              ;(event.currentTarget as HTMLInputElement).blur()
            }
          }}
          className="h-5 min-w-0 flex-1 rounded border border-border bg-bg px-2 font-mono text-[12px] text-text-secondary outline-none focus:border-accent/50"
          spellCheck={false}
        />

        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
          title="Go"
          onClick={navigateToInput}
        >
          {'→'}
        </button>

        {warningBadge}
      </div>

      {isLoading ? <div className="h-[2px] w-full animate-pulse bg-accent/70" /> : null}

      <div className="relative min-h-0 flex-1">
        {isElectron ? (
          <webview
            ref={(element) => {
              webviewRef.current = element as HTMLWebViewElement | null
            }}
            src={currentUrl}
            partition={`persist:project-${projectId}`}
            className="h-full w-full bg-bg"
            allowpopups="false"
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            title="Browser panel fallback"
            className="h-full w-full border-0 bg-bg"
            tabIndex={-1}
            onLoad={() => {
              setIsLoading(false)
              setLoadError(null)
            }}
          />
        )}

        {loadError ? (
          <div className="absolute inset-4 rounded border border-red-500/30 bg-bg-raised/95 p-3">
            <p className="text-xs font-semibold text-red-300">Navigation failed</p>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{loadError}</p>
            <button
              type="button"
              className="mt-3 rounded border border-border px-2 py-1 text-xs text-text-primary hover:bg-bg-hover"
              onClick={navigateToInput}
            >
              Retry
            </button>
          </div>
        ) : null}

        {isResizing ? <div className="absolute inset-0 z-20 bg-transparent" /> : null}
      </div>
    </div>
  )
}
