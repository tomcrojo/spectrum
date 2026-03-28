# Centipede — Project Cockpit

## What This Is

A lightweight Electron desktop app for managing coding projects. Combines a dense Codex-like UI, per-project workspaces (Niri-inspired horizontal/vertical canvas), Notion-like project dashboards, and multi-provider support for CLI coding tools (codex-cli, claude-code, opencode).

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Shell | Electron | 34.x |
| Build | electron-vite | 3.x |
| UI | React 19 + Tailwind CSS 4 | 19.1 / 4.1 |
| State | Zustand | 5.x |
| Persistence | SQLite via better-sqlite3 | 11.x |
| Terminal (Phase 2) | xterm.js + node-pty | — |
| Browser (Phase 3) | Electron webview + partition | — |
| Pane layout (Phase 2) | Allotment | — |
| Language | TypeScript | 5.8 |

## Project Structure

```
centipede/
├── package.json
├── electron.vite.config.ts          # Vite config for main/preload/renderer
├── electron-builder.yml             # Packaging config
├── tsconfig.json                    # Root (references node + web)
├── tsconfig.node.json               # Main + preload processes
├── tsconfig.web.json                # Renderer process
├── src/
│   ├── main/                        # Electron main process (Node.js)
│   │   ├── index.ts                 # App lifecycle, window creation
│   │   ├── windows.ts               # BrowserWindow factory
│   │   ├── ipc/
│   │   │   ├── index.ts             # Registers all IPC handlers
│   │   │   ├── projects.ipc.ts      # Project + Task + Dialog handlers
│   │   │   ├── workspace.ipc.ts     # Workspace handlers
│   │   │   └── terminal.ipc.ts      # Placeholder (Phase 2)
│   │   ├── db/
│   │   │   ├── database.ts          # SQLite init, WAL mode, migration runner
│   │   │   ├── migrations/001-init.sql  # Schema: projects, tasks, decisions, notes, env_vars, workspaces
│   │   │   ├── projects.repo.ts     # Project CRUD queries
│   │   │   ├── tasks.repo.ts        # Task CRUD queries
│   │   │   └── workspaces.repo.ts   # Workspace CRUD queries
│   │   └── providers/               # Provider abstraction (Phase 3)
│   │       ├── types.ts
│   │       ├── registry.ts
│   │       └── codex/CodexAdapter.ts
│   ├── preload/
│   │   ├── index.ts                 # contextBridge: exposes { invoke, on, once }
│   │   └── index.d.ts               # Window.api type declaration
│   ├── renderer/
│   │   ├── index.html               # Entry HTML
│   │   └── src/
│   │       ├── main.tsx             # React root mount
│   │       ├── App.tsx              # Root component
│   │       ├── global.css           # Tailwind @theme tokens, dark theme, monospace font
│   │       ├── stores/
│   │       │   ├── projects.store.ts    # Project list + tasks state + CRUD actions
│   │       │   ├── workspaces.store.ts  # Workspace list + CRUD actions
│   │       │   └── ui.store.ts          # Active project, sidebar state, modals
│   │       ├── components/
│   │       │   ├── layout/
│   │       │   │   ├── AppShell.tsx      # Top-level: sidebar + content
│   │       │   │   └── Sidebar.tsx       # Project list, new project button
│   │       │   ├── sidebar/
│   │       │   │   ├── ProjectCard.tsx       # Compact card with progress icon
│   │       │   │   ├── NewProjectButton.tsx  # "+ New Project" button
│   │       │   │   └── NewProjectModal.tsx   # Create project form with dir picker
│   │       │   ├── project/
│   │       │   │   ├── ProjectPage.tsx       # Main project view with all sections
│   │       │   │   ├── ProjectHeader.tsx     # Name, progress, editable description
│   │       │   │   ├── TaskList.tsx          # Add/toggle/delete tasks
│   │       │   │   └── WorkspaceList.tsx     # Workspace summary + create
│   │       │   └── shared/
│   │       │       ├── Button.tsx        # Variants: primary/secondary/ghost/danger
│   │       │       ├── Input.tsx         # Input + Textarea components
│   │       │       ├── Modal.tsx         # Overlay modal with ESC close
│   │       │       └── ProgressIcon.tsx  # SVG progress indicators (◔ ◑ ◕ ⚫)
│   │       └── lib/
│   │           ├── ipc.ts           # Typed wrappers: projectsApi, tasksApi, workspacesApi, dialogsApi
│   │           └── cn.ts            # clsx + tailwind-merge utility
│   └── shared/                      # Cross-process types (main + renderer)
│       ├── ipc-channels.ts          # All IPC channel name constants
│       ├── project.types.ts         # Project, Task, Decision, Note, EnvVar types
│       ├── workspace.types.ts       # Workspace, PanelConfig, WorkspaceLayoutState types
│       └── provider.types.ts        # ProviderInfo, ChatMessage types
```

## Architecture Decisions

### Data Flow: Renderer → IPC → SQLite → IPC → Zustand

All mutations follow this path:
1. Renderer calls `window.api.invoke(channel, payload)` via typed wrapper in `lib/ipc.ts`
2. Main process IPC handler receives the call, writes to SQLite
3. Main process returns the confirmed data
4. Zustand store updates its local cache with the confirmed result

This avoids optimistic updates diverging from disk. The SQLite database is the single source of truth.

### IPC Channel Convention

Channels follow `domain:action` naming: `project:create`, `task:toggle`, `workspace:list`, etc. All channel names are defined as constants in `src/shared/ipc-channels.ts`. CRUD operations use `ipcRenderer.invoke` / `ipcMain.handle` (request-response). Streaming data (terminal output, chat chunks in future phases) will use `webContents.send` (fire-and-forget).

### Zustand Store Split

Three independent stores to avoid coupling:
- `projects.store` — project list, tasks for active project, all CRUD actions
- `workspaces.store` — workspace list per project, CRUD actions
- `ui.store` — active project ID, sidebar collapsed state, modal visibility

### SQLite Setup

- Database location: `app.getPath('userData')/centipede.db` (e.g., `~/Library/Application Support/centipede/centipede.db`)
- WAL mode enabled for concurrent read performance
- Foreign keys enabled with cascade deletes
- Migrations run from numbered `.sql` files in `src/main/db/migrations/`
- Migration tracking via `_migrations` table

### Tailwind CSS 4 Theme

Custom dark theme using `@theme` block in `global.css`. Key tokens:
- Backgrounds: `bg` (#0a0a0a), `bg-raised` (#141414), `bg-surface` (#1a1a1a), `bg-hover` (#222), `bg-active` (#2a2a2a)
- Text: `text-primary` (#e5e5e5), `text-secondary` (#a3a3a3), `text-muted` (#737373)
- Progress colors: `progress-0` (gray), `progress-1` (blue), `progress-2` (purple), `progress-3` (green)
- Monospace font stack: SF Mono, Menlo, Monaco, Cascadia Code, Consolas
- 13px base font size

### electron-vite Configuration

- `externalizeDepsPlugin()` for main and preload (keeps native modules external)
- `nanoid` excluded from externalization (ESM-only, must be bundled)
- Path aliases: `@shared` → `src/shared`, `@renderer` → `src/renderer/src`
- React plugin + Tailwind CSS Vite plugin for renderer

### Frameless Window

- `titleBarStyle: 'hiddenInset'` with traffic lights at (16, 16)
- Custom drag region via CSS `-webkit-app-region: drag`
- `.no-drag` class for interactive elements within the drag region
- Dark background (#0a0a0a) to prevent white flash on load

## Critical Runtime Note

**`ELECTRON_RUN_AS_NODE` must be unset** when launching the app. Claude Code (and other Electron-based tools) set this environment variable, which causes Electron to run as plain Node.js instead of the Electron main process. The `npm run dev` script handles this with `unset ELECTRON_RUN_AS_NODE &&` prefix.

If you see `TypeError: Cannot read properties of undefined (reading 'whenReady')`, this is the cause.

## Running the App

```bash
npm run dev      # Dev mode with HMR (unsets ELECTRON_RUN_AS_NODE automatically)
npm run build    # Production build to out/
```

To run the built app manually from a terminal where ELECTRON_RUN_AS_NODE might be set:
```bash
ELECTRON_RUN_AS_NODE= ./node_modules/.bin/electron .
```

## Testing & Visualizing the UI (for AI agents)

**Use the `dev-browser` CLI to test and visualize the renderer UI without needing a human to manually open the app.** When `npm run dev` is running, the Vite dev server serves the renderer at `http://localhost:5173/`. You can use `dev-browser` to load that URL, take screenshots, and verify the UI looks correct — all without a human in the loop.

This enables faster iteration cycles: make a change → rebuild → use `dev-browser` to screenshot → verify the result → fix issues — all autonomously.

```bash
# 1. Start the dev server (in background or separate terminal)
unset ELECTRON_RUN_AS_NODE && npx electron-vite dev &

# 2. Use dev-browser to visit the renderer and take a screenshot
dev-browser http://localhost:5173/
```

**Note:** The renderer at `localhost:5173` runs without Electron APIs (no `window.api`), so IPC calls will fail. This is fine for visual/layout testing. For full integration testing (IPC, SQLite, etc.), you need the full Electron app running.

If you get stuck on implementation issues, use the **codex** CLI to ask for help.

## QA Protocol for AI Agents

**After completing any task or phase, launch a subagent to perform a QA report.** This ensures quality and catches regressions before handing off to the next person.

### QA Checklist Template

When launching the QA subagent, include:

1. **Builds without errors** — `npm run build` completes successfully
2. **App launches** — `ELECTRON_RUN_AS_NODE= ./node_modules/.bin/electron .` runs without crashes
3. **Visual inspection** — Use `dev-browser http://localhost:5173/` to screenshot key UI screens
4. **Feature verification** — Test the specific features added in the task
5. **Regression check** — Verify existing features still work (project CRUD, task list, sidebar nav)
6. **Database integrity** — Check that SQLite schema is correct and migrations applied
7. **Console errors** — No TypeScript errors, no React warnings, no runtime exceptions in dev tools
8. **File structure** — New files are in the right places, imports are correct

### Example QA Subagent Prompt

```
Run a QA report for Phase 1 completion:
1. Build the project and verify no errors
2. Start npm run dev, use dev-browser to screenshot the app
3. Create a new project via the modal, verify it appears in sidebar
4. Add tasks to the project, verify they persist
5. Check the SQLite database was created with correct schema
6. Verify no console errors or TypeScript issues
Provide a detailed report of pass/fail for each item.
```

This keeps the codebase stable and catches issues early.

## Database Schema

```sql
-- projects: Core project metadata
-- tasks: Per-project task items with completion state
-- decisions: Per-project decision log entries
-- notes: Per-project freeform notes
-- env_vars: Per-project environment variables (with secret flag)
-- workspaces: Per-project workspace containers with JSON layout_state
```

All tables use TEXT primary keys (nanoid). Timestamps are ISO strings. Booleans are stored as INTEGER (0/1). The `workspaces.layout_state` column stores a JSON blob of `{ panels: PanelConfig[], sizes: number[] }`.

## Product Concepts

- **Project** = container for context (name, repo path, env vars, tasks, decisions, notes)
- **Workspace** = execution unit inside a project (has terminals, browsers, chat panels)
- **Chat** = control surface inside a project, not the center of the app
- **Dashboard** = the project page, acts as memory/source of truth (Notion-like)

The sidebar shows compact project cards (name + progress icon + short status). The project page shows full details. No duplicate UI between the two.

## Future Architecture (not yet built)

### Terminal Model (Phase 2)
- `PtyManager` in main process: `Map<string, IPty>` of active terminals
- Spawns PTY at project repo path with merged env vars from project settings
- Streams stdout via `webContents.send('terminal:data:<id>', data)`
- xterm.js FitAddon resize → IPC → `pty.resize()`

### Browser Model (Phase 3)
- Electron `<webview>` tag with `partition={persist:project-${projectId}}`
- Each project gets isolated cookies, localStorage, HTTP cache
- Cookie import between projects is explicit (one-way)

### Workspace Layout (Phase 2)
- Nested Allotment panes: outer vertical (workspace strips), inner horizontal (panels)
- Panel config persisted as JSON in `workspaces.layout_state`
- Panels lazy-mounted (only rendered when workspace is visible)

### Provider Abstraction (Phase 3)
- `ProviderAdapter` interface: `sendMessage()` → `AsyncIterable<string>`
- Codex CLI adapter spawns CLI as child process
- Registry holds adapter instances, checks availability
- Provider switching is explicit per project
