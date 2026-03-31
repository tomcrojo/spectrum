# Spectrum — TODO Tracker

## Phase 1 — Scaffold + Core Shell

| # | Task | Status |
|---|------|--------|
| 1 | Init electron-vite project (package.json, electron.vite.config.ts, tsconfigs, electron-builder.yml) | ✅ Done |
| 2 | Tailwind 4 setup (global.css with @theme dark tokens) | ✅ Done |
| 3 | Shared types (ipc-channels.ts, project.types.ts, workspace.types.ts, provider.types.ts) | ✅ Done |
| 4 | SQLite layer (database.ts, 001-init.sql migration, projects.repo.ts, tasks.repo.ts, workspaces.repo.ts) | ✅ Done |
| 5 | IPC handlers (ipc/index.ts, projects.ipc.ts with CRUD for projects + tasks + directory dialog) | ✅ Done |
| 6 | Preload (contextBridge with invoke/on/once, type declarations) | ✅ Done |
| 7 | Main process (index.ts app lifecycle, windows.ts BrowserWindow factory) | ✅ Done |
| 8 | Renderer entry (main.tsx, App.tsx, global.css) | ✅ Done |
| 9 | Zustand stores (projects.store.ts, workspaces.store.ts, ui.store.ts) | ✅ Done |
| 10 | Layout (AppShell.tsx with sidebar + content split, Sidebar.tsx) | ✅ Done |
| 11 | Sidebar components (ProjectCard.tsx, NewProjectButton.tsx, NewProjectModal.tsx) | ✅ Done |
| 12 | Project page (ProjectPage.tsx, ProjectHeader.tsx, TaskList.tsx, WorkspaceList.tsx) | ✅ Done |
| 13 | Shared UI (Button.tsx, Input.tsx/Textarea, Modal.tsx, ProgressIcon.tsx, cn.ts) | ✅ Done |
| 14 | ELECTRON_RUN_AS_NODE fix in npm scripts | ✅ Done |
| 15 | .gitignore | ✅ Done |

## Phase 2 — Terminals + Workspaces

| # | Task | Status |
|---|------|--------|
| 1 | Install node-pty + xterm.js + @xterm/addon-fit + allotment | ⬜ Pending |
| 2 | PtyManager in main process (spawn, resize, write, close) | ⬜ Pending |
| 3 | Terminal IPC channels (terminal:create, terminal:write, terminal:resize, terminal:data, terminal:close) | ⬜ Pending |
| 4 | TerminalPanel component (xterm.js wrapper with FitAddon) | ⬜ Pending |
| 5 | useTerminal hook (connect xterm ↔ IPC ↔ PTY) | ⬜ Pending |
| 6 | WorkspaceCanvas component (Allotment-based resizable layout) | ⬜ Pending |
| 7 | Workspace CRUD IPC + UI (create, switch, archive) | ⬜ Pending |
| 8 | Layout persistence (save/restore panel arrangement to workspaces.layout_state) | ⬜ Pending |
| 9 | Env var injection into terminal sessions | ⬜ Pending |
| 10 | Terminal mode choice (clean terminal vs project-root terminal) | ⬜ Pending |

## Phase 3 — Browser + Chat Shell

| # | Task | Status |
|---|------|--------|
| 1 | BrowserPanel component (webview tag with URL bar) | ⬜ Pending |
| 2 | Partition-based cookie isolation per project | ⬜ Pending |
| 3 | ChatPanel UI (message list, input, streaming display) | ⬜ Pending |
| 4 | ChatMessage + ChatInput components | ⬜ Pending |
| 5 | Provider abstraction layer (ProviderAdapter interface, registry) | ⬜ Pending |
| 6 | Codex CLI adapter (spawn CLI, stream responses as AsyncIterable) | ⬜ Pending |
| 7 | Provider IPC channels (provider:list, provider:send, provider:chunk) | ⬜ Pending |
| 8 | "Add panel" button in workspace (choose terminal/browser/chat) | ⬜ Pending |
| 9 | Cookie import between projects | ⬜ Pending |

## Phase 4 — Polish + Features

| # | Task | Status |
|---|------|--------|
| 1 | Project onboarding flow (wizard/modal with all settings) | ⬜ Pending |
| 2 | DecisionLog component (add/view decisions) | ⬜ Pending |
| 3 | NotesSection component (freeform notes) | ⬜ Pending |
| 4 | EnvVarsPanel component (key-value editor) | ⬜ Pending |
| 5 | SecretsPanel component (masked values) | ⬜ Pending |
| 6 | Archive/delete projects and workspaces | ⬜ Pending |
| 7 | Git worktree toggle + integration | ⬜ Pending |
| 8 | Keyboard shortcuts | ⬜ Pending |
| 9 | Sidebar hover tooltips (extended project info) | ⬜ Pending |
| 10 | Lazy loading performance pass (browsers/terminals only when opened) | ⬜ Pending |
| 11 | Project page section linking (@ mentions in chat) | ⬜ Pending |
| 12 | Agent-editable project dashboard (distinct from user edits) | ⬜ Pending |
