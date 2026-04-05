interface WebViewRenderProcessGoneEvent extends Event {
  reason:
    | 'clean-exit'
    | 'abnormal-exit'
    | 'killed'
    | 'crashed'
    | 'oom'
    | 'launch-failed'
    | 'integrity-failure'
  exitCode: number
}

interface HTMLWebViewElement extends HTMLElement {
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  loadURL(url: string): void
  reload(): void
  stop(): void
  getWebContentsId(): number
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'render-process-gone',
    listener: (event: WebViewRenderProcessGoneEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'unresponsive' | 'responsive',
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLWebViewElement>,
      HTMLWebViewElement
    > & {
      src?: string
      partition?: string
      allowpopups?: boolean | string
    }
  }
}
