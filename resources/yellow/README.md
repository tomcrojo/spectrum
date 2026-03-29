# Browser CLI

`browser` is Centipede's browser automation CLI. It behaves like a `dev-browser`-style script runner, but targets browser panels inside the active Centipede workspace instead of opening external Chrome.

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

## Mental model

- a Centipede workspace is the browser session
- a browser panel is a page
- `listPages()` returns mounted browser panels in the connected workspace
- `newPage()` creates a new browser panel in that workspace

## Available globals

- `browser`
- `console`
- `saveScreenshot(buffer, name)`
- `writeFile(name, data)`
- `readFile(name)`
- `setTimeout`, `clearTimeout`

Scripts run in Node, not in the browser context. Use `page.evaluate(...)` for DOM-side JavaScript.
