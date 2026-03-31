# Spectrum

Spectrum is a desktop project cockpit for coding work. It combines a dense Electron UI, project dashboards, canvas-style workspaces, terminals, browser panels, and chat-oriented workflows into one app.

This repo is being built in public. It is usable, but it is still early, opinionated, and incomplete by design.

## Status

- Early alpha
- Build in public
- Good fit for following the project and trying ideas
- Not yet polished enough to promise stability across every workflow

## What Exists Today

- Project dashboard backed by SQLite
- Project metadata and task tracking
- Multi-workspace canvas model
- Terminal, browser, file, and T3Code-oriented panel flows
- Dense desktop-first UI built with Electron, React, Zustand, and Tailwind CSS 4

## Near-Term Priorities

The next release is expected to focus on:

- Git worktrees
- UI overhaul, including favicons and richer project visuals
- Chat panel improvements so it feels closer to Codex
- Performance improvements
- Customizable panels, including choosing which panels appear in the `New` menu versus an `All panels` overflow
- OpenCode as a provider
- Model selection

## Why It Exists

Most coding tools are centered around a single chat or terminal. Spectrum is aimed at the project layer around that work: tasks, workspace layout, repo context, lightweight memory, and multiple execution surfaces inside the same desktop app.

## Stack

- Electron
- React 19
- Tailwind CSS 4
- Zustand
- SQLite via `better-sqlite3`
- TypeScript

## Development

Requirements:

- Node.js 20+
- npm
- `git` with submodule support
- macOS is the primary development target right now
- Bun is recommended if you want the embedded T3Code runtime to work locally

Clone the repo:

```bash
git clone --recurse-submodules <repo-url>
cd spectrum
```

If you already cloned it without submodules:

```bash
git submodule update --init --recursive
```

Install and start the app:

```bash
npm install
npm run dev
```

Build production bundles:

```bash
npm run build
npm run dist:mac
```

Important runtime note:

`ELECTRON_RUN_AS_NODE` must be unset when launching Electron. The `npm run dev` script already handles this.

## Project Layout

- `src/main`: Electron main process, IPC, SQLite, runtime managers
- `src/preload`: renderer bridge
- `src/renderer`: React UI
- `src/shared`: cross-process types and IPC channel definitions
- `resources`: helper projects and runtime assets used during development

## Known Limitations

- Spectrum is still an alpha and workflow details may change quickly.
- macOS is the primary supported environment today.
- The embedded T3Code workflow depends on the `resources/t3code` submodule and Bun.
- DMG builds are currently intended for testing and are not notarized yet.
- The repo still contains research/reference dependencies while the product is being shaped in public.

## Third-Party Code

Spectrum currently uses a mix of vendored helpers and git submodules for development-time workflows. See [THIRD_PARTY.md](./THIRD_PARTY.md) for the current inventory and upstream links.

## Contributing

Issues and PRs are welcome, especially around:

- bugs and regressions
- performance bottlenecks
- Electron security hardening
- project/workspace UX
- documentation gaps

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the current workflow.

## Release Process

For public alpha drops, use the checklist in [docs/release-checklist.md](./docs/release-checklist.md).

## License

MIT. See [LICENSE](./LICENSE).
