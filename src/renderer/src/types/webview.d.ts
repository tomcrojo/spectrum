interface HTMLWebViewElement extends HTMLElement {
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  loadURL(url: string): void
  reload(): void
  stop(): void
  getWebContentsId(): number
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLWebViewElement>,
      HTMLWebViewElement
    > & {
      src?: string
      partition?: string
      allowpopups?: string
    }
  }
}
