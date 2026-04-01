# Browser CLI

`browser` / `browser-cli` is Spectrum's browser automation CLI.

It controls browser panels inside a running Spectrum workspace. It does not open or manage external Chrome windows.

## Start here

Use the CLI help surface as the canonical guide:

```bash
browser --help
browser guide
```

`browser guide` is the full AI-oriented usage guide. It covers:
- the Spectrum workspace/panel mental model
- the script environment
- the recommended workflow
- forbidden raw-CDP patterns
- the cleanup model for `browser.newPage(...)`

## Quick reference

Create a durable panel:

```bash
browser open "https://example.com" --name "docs" --focus
browser search "release notes" --focus
```

Inspect the current workspace session:

```bash
browser status --json
browser list --json
```

Use advanced DOM automation only when you need a Playwright page:

```bash
browser --connect <<'EOF'
const page = await browser.getPage("docs");
console.log(JSON.stringify({
  url: page.url(),
  title: await page.title()
}, null, 2));
EOF
```

Create an ephemeral automation page:

```bash
browser --connect <<'EOF'
const page = await browser.newPage({ url: "https://example.com" });
console.log(await page.title());
EOF
```

By default, `browser.newPage(...)` is temporary and auto-closes at the end of the script. Use `browser.newPage({ persistent: true })` or `browser open` / `browser search` when you want durable workspace state.

## Common mistakes

- `browser-cli connect`
  `connect` is a flag, not a subcommand. Use `browser --connect <<'EOF' ... EOF`.
- raw `/devtools/page/...` sockets in scripts
  Use `browser.getPage(...)` or `browser.newPage(...)` instead.
- expecting external Chrome control
  `browser-cli` only controls Spectrum browser panels.
