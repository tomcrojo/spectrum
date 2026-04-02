# Performance Benchmarking

`scripts/perf-benchmark.mjs` is a repeatable benchmark harness for Spectrum.

It covers two runtime modes:

- `browser`: runs `npm run dev:browser` equivalents under Playwright-controlled Chrome. This exercises the real React app, Zustand stores, SQLite, PTY, file IO, and the standalone backend transport.
- `electron`: builds the app and launches the real Electron shell under Playwright. This is the production-fidelity path for shell overhead, BrowserWindow behavior, Electron process topology, and `<webview>` cost.

## Why both modes exist

Browser mode is useful for fast, repeatable automation, but it is not a full proxy for Electron performance:

- Browser mode talks to a standalone Node backend over WebSocket instead of preload IPC.
- Browser panels render as `iframe`s in browser mode, not Electron `<webview>` guests.
- Electron adds BrowserWindow, preload, guest process, and Chromium multi-process overhead that browser mode does not capture.

Use browser mode for quick regressions and Electron mode for release-grade performance checks.

## What the benchmark does

The script seeds an isolated SQLite database with:

- A large project
- A medium project
- Several filler projects for sidebar load
- Multiple workspaces per project
- Multiple panels per workspace
- Enough terminal and file panels to stress renderer mounting and PTY creation

Then it measures:

- Cold start time
- Repeated project-open timings using the app's dev perf snapshot
- Renderer heap usage when available
- Electron process working-set totals in Electron mode
- Page errors, console errors, and warnings

## Usage

```bash
npm run benchmark:perf
```

Useful variants:

```bash
npm run benchmark:perf -- --mode=browser
npm run benchmark:perf -- --mode=electron
npm run benchmark:perf -- --runtime-power=mid
npm run benchmark:perf -- --large-workspaces=10 --panels-per-workspace=4
npm run benchmark:perf -- --headed
```

Reports are written to `artifacts/performance/`.

## Notes for Apple Silicon validation

- Run the same scenario on each target machine class, for example M1 Air, M2 Air, M3 Pro, M4 Air.
- Keep the scenario, runtime power mode, and build state identical across runs.
- Compare Electron mode first. That is the relevant signal for shipped app behavior.
- Treat browser mode as a regression harness, not as the final answer for Electron stability.
