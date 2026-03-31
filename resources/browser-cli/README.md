# Browser CLI

`browser` / `browser-cli` is Spectrum's browser automation CLI.

It controls browser panels inside a running Spectrum workspace. It does not open or manage external Chrome windows.

## Mental model

- a Spectrum workspace session is the browser session
- a browser panel is a page
- browser-cli focus is internal agent focus, not user-visible UI focus
- `browser search <query>` opens search results in a new browser panel
- `browser open <url>` or `browser.openPanel(...)` creates a new browser panel inside that workspace
- `browser.newPage(...)` prefers a temporary helper panel so automation can attach without stealing the user's focus
- `browser.listPages()` only lists mounted browser panels in the connected workspace
- `--connect` attaches to the active Spectrum workspace session, not to arbitrary Chrome or a random DevTools endpoint

## Preconditions

Before using `browser-cli`:

- Spectrum must already be running
- a project/workspace must be active
- if you want CDP-backed page control, the workspace must have a mounted browser panel
- Spectrum may mount an agent-targeted helper panel in the background while leaving the user's visible focus untouched
- inside Spectrum-managed shells, prefer `$SPECTRUM_BROWSER` if `browser` is not on `PATH`

If you are trying to open a standalone Chrome window, this is the wrong tool.

## Quick start

```bash
browser --help
"$SPECTRUM_BROWSER" --help
browser search "folagor" --engine youtube --focus
browser open "https://www.youtube.com/results?search_query=folagor" --name "YouTube: folagor" --focus

browser --connect <<'EOF'
const pages = await browser.listPages();
console.log(JSON.stringify(pages, null, 2));
EOF

browser --connect <<'EOF'
const page = await browser.newPage({ name: 'docs', url: 'https://example.com' });
console.log(JSON.stringify({
  id: page.id(),
  url: page.url(),
  title: await page.title()
}, null, 2));
EOF
```

## Recommended agent patterns

Create a new browser panel:

```bash
browser open "https://example.com" --name "docs" --focus
```

Search directly:

```bash
browser search "edm music" --engine youtube --focus
browser search "best espresso madrid" --engine google --focus
```

List mounted browser panels:

```bash
browser list --json
```

Inspect the current workspace session:

```bash
browser status --json
```

Run a saved script:

```bash
browser run script.js
```

Use advanced DOM automation only when you need a Playwright page:

```bash
browser --connect <<'EOF'
const page = await browser.getPage("docs");
console.log(await page.title());
EOF
```

## Common mistakes

- `browser-cli open`
  Prefer `browser open <url>`.
- `browser-cli search`
  Use `browser search <query> --engine youtube` or omit `--engine` to default to Google.
- `browser-cli connect`
  `connect` is a flag, not a subcommand. Use `browser --connect <<'EOF' ... EOF`.
- expecting external Chrome control
  `browser-cli` only controls Spectrum browser panels.

## Available globals

- `browser`
- `console`
- `saveScreenshot(buffer, name)`
- `writeFile(name, data)`
- `readFile(name)`
- `setTimeout`, `clearTimeout`

Scripts run in Node, not in the browser context. Use `page.evaluate(...)` for DOM-side JavaScript.
