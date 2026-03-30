# Browser CLI

`browser` / `browser-cli` is Centipede's browser automation CLI.

It controls browser panels inside a running Centipede workspace. It does not open or manage external Chrome windows.

## Mental model

- a Centipede workspace session is the browser session
- a browser panel is a page
- `browser.newPage()` creates a new browser panel inside that workspace
- `browser.listPages()` only lists mounted browser panels in the connected workspace
- `--connect` attaches to the active Centipede workspace session, not to arbitrary Chrome or a random DevTools endpoint

## Preconditions

Before using `browser-cli`:

- Centipede must already be running
- a project/workspace must be active
- if you want CDP-backed page control, the workspace must have a mounted browser panel

If you are trying to open a standalone Chrome window, this is the wrong tool.

## Quick start

```bash
browser --help

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
browser --connect <<'EOF'
const page = await browser.newPage({ url: 'https://example.com' });
await page.focus();
console.log(page.id());
EOF
```

List mounted browser panels:

```bash
browser --connect <<'EOF'
console.log(JSON.stringify(await browser.listPages(), null, 2));
EOF
```

Inspect the current workspace session:

```bash
browser --json
```

Run a saved script:

```bash
browser run script.js
```

## Common mistakes

- `browser-cli open`
  This command does not exist. Use `browser.newPage(...)` inside a script.
- `browser-cli connect`
  `connect` is a flag, not a subcommand. Use `browser --connect <<'EOF' ... EOF`.
- expecting external Chrome control
  `browser-cli` only controls Centipede browser panels.

## Available globals

- `browser`
- `console`
- `saveScreenshot(buffer, name)`
- `writeFile(name, data)`
- `readFile(name)`
- `setTimeout`, `clearTimeout`

Scripts run in Node, not in the browser context. Use `page.evaluate(...)` for DOM-side JavaScript.
