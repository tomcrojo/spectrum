export const GUIDE_TEXT = `browser-cli AI Guide

Spectrum mental model:
  - a Spectrum workspace session is the browser session
  - a Spectrum browser panel is the page
  - browser-cli focus is internal agent focus, not always the user's visible focus
  - browser-cli does not control external Chrome windows

Script environment:
  - scripts run as Node AsyncFunction code, not QuickJS
  - top-level await is available
  - browser, console, saveScreenshot, writeFile, readFile, Buffer, setTimeout, and clearTimeout are available
  - use browser.getPage(...) / browser.newPage(...) instead of opening raw /devtools/... sockets

Recommended workflow:
  1. browser status --json
  2. if no panel exists, create one with browser open <url> or browser search <query>
  3. attach with browser --connect <<'EOF' ... EOF
  4. resolve a Playwright page with browser.getPage("<panel-or-name>")

Small-script guidance:
  - write one focused script per action or observation
  - end each script by logging the URL, title, or state you need next
  - use stable names only when you want durable workspace state
  - prefer browser.newPage(...) for temporary automation

Troubleshooting:
  - NO_SESSION: open Spectrum and keep the target workspace active, or re-establish the agent thread binding
  - AMBIGUOUS_SESSION: retry with --workspace <id>
  - NO_CDP_ENDPOINT: create a browser panel first with browser open or browser search
  - TARGET_NOT_READY: the panel exists but is still mounting; retry browser.getPage("<panel>")

Forbidden patterns:
  - raw /devtools/page/... or /devtools/browser/... WebSocket connections
  - connectOverCDP or direct Playwright/chromium connect calls
  - treating browser-cli like a generic external-browser controller
  - use --no-preflight only when you intentionally accept unsupported behavior

Cleanup model:
  - browser.newPage(...) is ephemeral by default and auto-closes at the end of the script
  - browser.newPage({ persistent: true }) keeps the panel open
  - browser.getPage(nonExistentName) creates a temporary automation panel in this pass
  - browser.openPanel(...), browser open, and browser search create durable panels

Examples:
  browser status --json

  browser open "https://example.com" --name "docs" --focus

  browser --connect <<'EOF'
  const page = await browser.getPage("docs");
  console.log(JSON.stringify({
    url: page.url(),
    title: await page.title()
  }, null, 2));
  EOF

  browser --connect <<'EOF'
  const page = await browser.newPage({ url: "https://example.com" });
  console.log(await page.title());
  EOF
`;

export const HELP_TEXT = `browser-cli controls browser panels inside a running Spectrum workspace.

Important:
  - It does not launch or control external Chrome windows.
  - It only works when Spectrum is already running and a workspace session is active.
  - \`--connect\` means "attach to the current Spectrum workspace session".
  - Inside \`browser --connect\` scripts, use \`browser.getPage(...)\` / \`browser.newPage(...)\`.
  - Run \`browser guide\` for the full AI usage guide and cleanup model.

Usage:
  browser help
  browser guide
  browser --help
  browser status --json
  browser open "https://example.com" --name "docs" --focus
  browser search "release notes" --focus
  browser --connect <<'EOF'
  const page = await browser.getPage("docs");
  console.log(await page.title());
  EOF

Options:
  --help, -h           Show this help text
  --json               Print structured JSON output
  --connect [target]   Attach to the active Spectrum workspace session
  --thread <id>        Target one T3Code thread's workspace
  --workspace <id>     Choose a specific Spectrum workspace
  --project <id>       Choose a specific Spectrum project
  --no-preflight       Disable script misuse checks for advanced/manual use

Commands:
  help                 Show this help text
  guide                Show the full AI usage guide
  status               Show session status and mounted browser panels
  list                 List mounted browser panels
  open <url>           Open a durable browser panel
  search <query>       Open a durable search panel
  goto <panel> <url>   Navigate an existing panel
  focus <panel>        Focus an existing panel
  close <panel>        Close an existing panel
  run <file>           Execute a script file
`;
