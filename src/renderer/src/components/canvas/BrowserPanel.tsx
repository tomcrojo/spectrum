import { useEffect, useMemo, useRef } from 'react'
import { Button } from '@renderer/components/shared/Button'
import {
  formatIssuePayload,
  IssueCopyButton
} from '@renderer/components/shared/IssueCopyButton'
import { browserApi } from '@renderer/lib/ipc'
import {
  formatBrowserLoadFailure,
  enqueueBrowserRuntimeCommand,
  isFatalBrowserLoadFailure,
  registerBrowserSlot
} from '@renderer/lib/browser-runtime'
import { incrementDevMountCount } from '@renderer/lib/dev-performance'
import { useWorkspacesStore } from '@renderer/stores/workspaces.store'
import { useBrowserUiStore } from '@renderer/stores/browser-ui.store'
import { usePanelRuntimeStore } from '@renderer/stores/panel-runtime.store'

interface BrowserPanelProps {
  panelId: string
  workspaceId: string
  projectId: string
  initialUrl?: string
  autoFocus: boolean
  isResizing: boolean
  hydrationState: 'live' | 'preview' | 'cold'
  hostEnabled: boolean
}

const TEMPORARY_POPUP_WIDTH = 350

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
  isResizing,
  hydrationState,
  hostEnabled
}: BrowserPanelProps) {
  const updatePanelLayout = useWorkspacesStore((state) => state.updatePanelLayout)
  const browserUi = useBrowserUiStore((state) => state.browserUiById[panelId])
  const panelRuntime = usePanelRuntimeStore((state) => state.panelRuntimeById[panelId])
  const isElectron = typeof window !== 'undefined' && typeof window.api !== 'undefined'
  const webviewRef = useRef<HTMLWebViewElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const slotRef = useRef<HTMLDivElement | null>(null)
  const webContentsIdRef = useRef<number | null>(null)
  const currentUrl = normalizeUrl(initialUrl ?? 'https://localhost:3000')
  const runtimeMode =
    panelRuntime?.browserRuntimeMode ??
    (hydrationState === 'live'
      ? 'visible'
      : hydrationState === 'preview'
        ? 'headless'
        : 'cold')
  const previewDataUrl = panelRuntime?.previewDataUrl
  const browserAutomationAttached = panelRuntime?.browserAutomationAttached ?? false
  const urlInputDraft = browserUi?.urlInputDraft ?? currentUrl
  const isAddressEditing = browserUi?.isAddressEditing ?? false
  const isLoading = browserUi?.isLocalLoading ?? false
  const loadError = browserUi?.loadError ?? null
  const canGoBack = browserUi?.canGoBack ?? false
  const canGoForward = browserUi?.canGoForward ?? false

  useEffect(() => {
    incrementDevMountCount('BrowserPanel')
  }, [])

  useEffect(() => {
    const browserUiStore = useBrowserUiStore.getState()
    browserUiStore.ensureBrowserUi(panelId, currentUrl)
    browserUiStore.syncUrlFromRuntime(panelId, currentUrl)
  }, [currentUrl, panelId])

  useEffect(() => {
    const slot = slotRef.current
    if (!slot) {
      return
    }

    slot.dataset.browserSlotResizing = isResizing ? 'true' : 'false'
  }, [isResizing])

  useEffect(() => {
    if (!hostEnabled) {
      return
    }

    const slot = slotRef.current
    if (!slot) {
      return
    }

    return registerBrowserSlot({
      panelId,
      workspaceId,
      projectId,
      element: slot
    })
  }, [hostEnabled, panelId, projectId, workspaceId])

  useEffect(() => {
    if (hostEnabled) {
      if (autoFocus && runtimeMode === 'visible') {
        enqueueBrowserRuntimeCommand({ panelId, type: 'focus' })
      }
      return
    }

    requestAnimationFrame(() => {
      if (autoFocus) {
        if (isElectron) {
          webviewRef.current?.focus()
        } else {
          iframeRef.current?.focus()
        }
        return
      }

      if (isElectron) {
        webviewRef.current?.blur()
      } else {
        iframeRef.current?.blur()
      }
    })
  }, [autoFocus, hostEnabled, isElectron, panelId, runtimeMode])

  useEffect(() => {
    if (hostEnabled) {
      return
    }

    if (isElectron && hydrationState === 'live') {
      const webview = webviewRef.current
      if (webview && webview.getAttribute('src') !== currentUrl) {
        webview.loadURL(currentUrl)
      }
      return
    }

    const iframe = iframeRef.current
    if (iframe && iframe.src !== currentUrl) {
      iframe.src = currentUrl
    }
  }, [currentUrl, hostEnabled, hydrationState, isElectron])

  useEffect(() => {
    if (hostEnabled || !isElectron || hydrationState !== 'live') {
      return
    }

    const webview = webviewRef.current
    if (!webview) {
      return
    }

    const browserUiStore = useBrowserUiStore.getState()
    const runtimeStore = usePanelRuntimeStore.getState()

    const handleDidStartLoading = () => {
      browserUiStore.updateBrowserUi(panelId, {
        loadError: null,
        isLocalLoading: true
      })
    }

    const handleDidStopLoading = () => {
      browserUiStore.updateBrowserUi(panelId, {
        isLocalLoading: false,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward()
      })
    }

    const handleDidNavigate = (event: { url: string }) => {
      updatePanelLayout(panelId, { url: event.url })
      browserUiStore.syncUrlFromRuntime(panelId, event.url)
    }

    const handleFailLoad = (event: {
      errorCode: number
      errorDescription: string
      validatedURL: string
      isMainFrame?: boolean
    }) => {
      if (!isFatalBrowserLoadFailure(event)) {
        return
      }

      browserUiStore.updateBrowserUi(panelId, {
        loadError: formatBrowserLoadFailure(event),
        isLocalLoading: false
      })
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
      runtimeStore.updatePanelRuntime(panelId, {
        browserRegisteredInMain: true,
        browserWebContentsId: webContentsId
      })
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
      browserApi
        .openTemporary({
          workspaceId,
          projectId,
          parentPanelId: panelId,
          returnToPanelId: panelId,
          url: normalizeUrl(event.url),
          width: TEMPORARY_POPUP_WIDTH,
          openedBy: 'popup'
        })
        .catch(() => {})
    }

    const handleFocus = () => {
      runtimeStore.markBrowserUserInteraction(panelId)
      browserApi
        .activate({
          workspaceId,
          panelId
        })
        .catch(() => {})
    }

    webview.addEventListener('did-start-loading', handleDidStartLoading as EventListener)
    webview.addEventListener('did-stop-loading', handleDidStopLoading as EventListener)
    webview.addEventListener('did-navigate', handleDidNavigate as unknown as EventListener)
    webview.addEventListener('did-navigate-in-page', handleDidNavigate as unknown as EventListener)
    webview.addEventListener('did-fail-load', handleFailLoad as unknown as EventListener)
    webview.addEventListener('page-title-updated', handleTitleUpdated as unknown as EventListener)
    webview.addEventListener('dom-ready', handleDomReady as EventListener)
    webview.addEventListener('new-window', handleNewWindow as unknown as EventListener)
    webview.addEventListener('focus', handleFocus as EventListener)

    return () => {
      webview.removeEventListener('did-start-loading', handleDidStartLoading as EventListener)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading as EventListener)
      webview.removeEventListener('did-navigate', handleDidNavigate as unknown as EventListener)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate as unknown as EventListener)
      webview.removeEventListener('did-fail-load', handleFailLoad as unknown as EventListener)
      webview.removeEventListener('page-title-updated', handleTitleUpdated as unknown as EventListener)
      webview.removeEventListener('dom-ready', handleDomReady as EventListener)
      webview.removeEventListener('new-window', handleNewWindow as unknown as EventListener)
      webview.removeEventListener('focus', handleFocus as EventListener)
      browserApi
        .webviewDestroyed({
          panelId,
          workspaceId,
          projectId,
          webContentsId: webContentsIdRef.current ?? undefined
        })
        .catch(() => {})
    }
  }, [
    hostEnabled,
    hydrationState,
    isElectron,
    panelId,
    projectId,
    updatePanelLayout,
    workspaceId
  ])

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
    const nextUrl = normalizeUrl(urlInputDraft)
    const browserUiStore = useBrowserUiStore.getState()
    const runtimeStore = usePanelRuntimeStore.getState()

    browserUiStore.setAddressEditing(panelId, false)
    browserUiStore.updateBrowserUi(panelId, {
      loadError: null,
      isLocalLoading: true
    })
    browserUiStore.syncUrlFromRuntime(panelId, nextUrl)
    runtimeStore.markBrowserUserInteraction(panelId)
    updatePanelLayout(panelId, { url: nextUrl })
    browserApi
      .urlChanged({
        panelId,
        url: nextUrl
      })
      .catch(() => {})

    if (hostEnabled) {
      enqueueBrowserRuntimeCommand({ panelId, type: 'navigate', url: nextUrl })
      return
    }

    if (isElectron) {
      webviewRef.current?.loadURL(nextUrl)
    } else if (iframeRef.current) {
      iframeRef.current.src = nextUrl
    }
  }

  const renderPlaceholder = () => {
    if (runtimeMode === 'headless') {
      return (
        <div className="flex h-full flex-col bg-bg">
          <div className="flex h-7 items-center gap-2 border-b border-border-subtle bg-bg-raised px-2">
            <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-secondary">
              {currentUrl}
            </div>
            <span className="rounded border border-border bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
              Live Headless
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center bg-bg p-4">
            <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-bg-raised">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Browser preview"
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-bg text-xs text-text-muted">
                  No preview available yet
                </div>
              )}
              <div className="space-y-2 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs font-medium text-text-primary">
                    Background browser runtime
                  </p>
                  {browserAutomationAttached ? (
                    <span className="rounded-full border border-text-muted/25 bg-bg px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
                      Agent attached
                    </span>
                  ) : null}
                </div>
                <p className="truncate font-mono text-[11px] text-text-secondary">{currentUrl}</p>
                <p className="text-xs leading-5 text-text-secondary">
                  This browser stays alive off-screen so agents can keep automating it.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="relative flex h-full min-h-0 flex-col bg-bg">
        <div className="relative flex h-7 items-center gap-2 border-b border-border-subtle bg-bg-raised px-2">
          <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-secondary">
            {currentUrl}
          </div>
          <span className="rounded border border-border bg-bg px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
            Parked
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center bg-bg">
          <div className="max-w-sm rounded-lg border border-border bg-bg-raised px-4 py-3 text-center">
            <p className="text-xs font-medium text-text-primary">Browser paused</p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              This browser will load when you focus its workspace.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderRuntimeSurface = () => {
    if (hostEnabled) {
      return (
        <div ref={slotRef} className="h-full w-full bg-bg">
          {runtimeMode === 'visible' ? null : renderPlaceholder()}
          {isResizing ? <div className="absolute inset-0 z-20 bg-transparent" /> : null}
        </div>
      )
    }

    if (hydrationState !== 'live') {
      return renderPlaceholder()
    }

    return (
      <>
        {isElectron ? (
          <webview
            ref={(element) => {
              webviewRef.current = element as HTMLWebViewElement | null
            }}
            src={currentUrl}
            partition={`persist:project-${projectId}`}
            className="h-full w-full bg-bg"
            allowpopups
            style={{ opacity: isResizing ? 0.85 : 1 }}
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            title="Browser panel fallback"
            className="h-full w-full border-0 bg-bg"
            tabIndex={-1}
            onLoad={() => {
              useBrowserUiStore.getState().updateBrowserUi(panelId, {
                isLocalLoading: false,
                loadError: null
              })
            }}
          />
        )}

        {loadError ? (
          <div className="absolute inset-4 rounded border border-red-500/30 bg-bg-raised/95 p-3 text-left">
            <p className="select-text text-xs font-semibold text-red-300">Navigation failed</p>
            <p className="mt-2 select-text text-xs leading-5 text-text-secondary">
              {loadError}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={navigateToInput}>
                Retry
              </Button>
              <IssueCopyButton
                payload={formatIssuePayload('Browser navigation failed', loadError, loadError)}
              />
            </div>
          </div>
        ) : null}

        {isResizing ? <div className="absolute inset-0 z-20 bg-transparent" /> : null}
      </>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <div className="relative flex h-7 items-center gap-2 border-b border-border-subtle bg-bg-raised px-2">
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-bg-hover hover:text-text-primary"
          title={isLoading ? 'Stop' : 'Reload'}
          onClick={() => {
            usePanelRuntimeStore.getState().markBrowserUserInteraction(panelId)
            if (hostEnabled) {
              enqueueBrowserRuntimeCommand({
                panelId,
                type: isLoading ? 'stop' : 'reload'
              })
              return
            }

            if (isElectron) {
              if (isLoading) {
                webviewRef.current?.stop()
              } else {
                webviewRef.current?.reload()
              }
              return
            }

            if (iframeRef.current) {
              iframeRef.current.src = currentUrl
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
            usePanelRuntimeStore.getState().markBrowserUserInteraction(panelId)
            if (hostEnabled) {
              enqueueBrowserRuntimeCommand({ panelId, type: 'back' })
              return
            }

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
            usePanelRuntimeStore.getState().markBrowserUserInteraction(panelId)
            if (hostEnabled) {
              enqueueBrowserRuntimeCommand({ panelId, type: 'forward' })
              return
            }

            if (isElectron && webviewRef.current?.canGoForward()) {
              webviewRef.current.goForward()
            }
          }}
        >
          {'>'}
        </button>

        <input
          value={urlInputDraft}
          onChange={(event) =>
            useBrowserUiStore.getState().setUrlInputDraft(panelId, event.target.value)
          }
          onFocus={() => useBrowserUiStore.getState().setAddressEditing(panelId, true)}
          onBlur={() => useBrowserUiStore.getState().setAddressEditing(panelId, false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              navigateToInput()
            } else if (event.key === 'Escape') {
              useBrowserUiStore.getState().setUrlInputDraft(panelId, currentUrl)
              useBrowserUiStore.getState().setAddressEditing(panelId, false)
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

      <div className="relative min-h-0 flex-1">{renderRuntimeSurface()}</div>
    </div>
  )
}
