# Contributing to Spectrum

Thanks for contributing. Spectrum is being built in public, so contributions should optimize for clarity and forward momentum rather than polish theater.

## Before You Start

- Open an issue for significant changes so the direction is clear before implementation
- Keep changes focused and easy to review
- Do not mix unrelated refactors into feature work
- Prefer incremental improvements over broad rewrites

## Local Setup

Requirements:

- Node.js 20+
- npm
- `git` with submodule support
- Bun if you need to run or debug the embedded T3Code runtime

Clone the repo:

```bash
git clone --recurse-submodules https://github.com/tomcrojo/spectrum.git
cd spectrum
```

If you already cloned it without submodules:

```bash
git submodule update --init --recursive
```

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run dev
```

Build before opening a PR:

```bash
npm run build
```

## Development Notes

- The app uses Electron, React, Zustand, Tailwind CSS 4, and SQLite
- SQLite is the source of truth; renderer state should reflect confirmed IPC results
- IPC channels follow `domain:action`
- `ELECTRON_RUN_AS_NODE` must be unset when launching Electron directly
- `resources/t3code`, `resources/dev-browser`, and the reference repos are tracked as submodules; if you update them, explain why and call out the upstream commit
- Avoid committing local design exports, scratch packaging output, or other machine-specific artifacts from the repo root

## Pull Request Guidelines

- Describe the problem first, then the approach
- Call out user-visible behavior changes clearly
- Mention any tradeoffs or follow-up work
- Include screenshots for meaningful UI changes when practical
- Keep documentation updated when behavior changes

## Current Areas Where Help Is Valuable

- Open-source release cleanup
- Performance work
- Workspace and panel UX
- Provider integrations
- Electron hardening
- Tests and CI

## Code Style

- TypeScript throughout
- Match existing file organization and naming
- Keep components and stores narrowly scoped
- Add comments only when the code would otherwise be hard to parse

## Licensing

By contributing, you agree that your contributions will be licensed under the MIT License used by this repository.
