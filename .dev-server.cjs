var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/dev-server/index.ts
var import_ws = require("ws");
var import_better_sqlite32 = __toESM(require("better-sqlite3"));
var import_child_process2 = require("child_process");
var import_path3 = require("path");
var import_fs3 = require("fs");
var import_os2 = require("os");

// node_modules/nanoid/index.js
var import_node_crypto = require("node:crypto");

// node_modules/nanoid/url-alphabet/index.js
var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

// node_modules/nanoid/index.js
var POOL_SIZE_MULTIPLIER = 128;
var pool;
var poolOffset;
function fillPool(bytes) {
  if (!pool || pool.length < bytes) {
    pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER);
    import_node_crypto.webcrypto.getRandomValues(pool);
    poolOffset = 0;
  } else if (poolOffset + bytes > pool.length) {
    import_node_crypto.webcrypto.getRandomValues(pool);
    poolOffset = 0;
  }
  poolOffset += bytes;
}
function nanoid(size = 21) {
  fillPool(size |= 0);
  let id = "";
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63];
  }
  return id;
}

// src/dev-server/index.ts
var pty = __toESM(require("node-pty"));

// src/main/t3code/T3CodeManager.ts
var import_child_process = require("child_process");
var import_fs2 = require("fs");
var import_os = require("os");
var import_path2 = require("path");
var import_net = __toESM(require("net"));
var import_better_sqlite3 = __toESM(require("better-sqlite3"));

// src/main/t3code/config.ts
var import_fs = require("fs");
var import_path = require("path");
function findProjectRoot() {
  const candidates = [
    process.cwd(),
    __dirname,
    (0, import_path.dirname)(require.main?.filename ?? process.cwd())
  ];
  for (const candidate of candidates) {
    let current = (0, import_path.resolve)(candidate);
    while (true) {
      const configPath = (0, import_path.join)(current, "centipede.config.json");
      const t3CodePackagePath = (0, import_path.join)(current, "resources", "t3code", "package.json");
      if ((0, import_fs.existsSync)(configPath) || (0, import_fs.existsSync)(t3CodePackagePath)) {
        return current;
      }
      const parent = (0, import_path.dirname)(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }
  return process.cwd();
}
var projectRoot = findProjectRoot();
function findExistingT3CodeSourcePath(preferredPath) {
  const candidates = [
    preferredPath,
    (0, import_path.join)(projectRoot, "resources", "t3code")
  ].filter((value) => Boolean(value));
  for (const candidate of candidates) {
    const resolvedCandidate = (0, import_path.resolve)(candidate);
    if ((0, import_fs.existsSync)((0, import_path.join)(resolvedCandidate, "package.json"))) {
      return resolvedCandidate;
    }
  }
  for (const base of [process.cwd(), __dirname, (0, import_path.dirname)(require.main?.filename ?? process.cwd())]) {
    let current = (0, import_path.resolve)(base);
    while (true) {
      const nestedCandidate = (0, import_path.join)(current, "resources", "t3code");
      if ((0, import_fs.existsSync)((0, import_path.join)(nestedCandidate, "package.json"))) {
        return nestedCandidate;
      }
      const parent = (0, import_path.dirname)(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }
  return (0, import_path.resolve)(preferredPath ?? (0, import_path.join)(projectRoot, "resources", "t3code"));
}
var defaultConfig = {
  sourcePath: findExistingT3CodeSourcePath((0, import_path.join)(projectRoot, "resources", "t3code")),
  installCommand: "bun install --frozen-lockfile",
  buildCommand: "bun run --cwd apps/web build && bun run --cwd apps/server build",
  entrypoint: "apps/server/dist/index.mjs"
};
var cachedConfig = null;
function getT3CodeConfig() {
  if (cachedConfig) return cachedConfig;
  const configPath = (0, import_path.join)(projectRoot, "centipede.config.json");
  if (!(0, import_fs.existsSync)(configPath)) {
    cachedConfig = defaultConfig;
    return cachedConfig;
  }
  try {
    const parsed = JSON.parse(
      (0, import_fs.readFileSync)(configPath, "utf8")
    );
    cachedConfig = {
      sourcePath: findExistingT3CodeSourcePath(
        parsed.t3code?.sourcePath ? (0, import_path.resolve)(projectRoot, parsed.t3code.sourcePath) : defaultConfig.sourcePath
      ),
      installCommand: parsed.t3code?.installCommand || defaultConfig.installCommand,
      buildCommand: parsed.t3code?.buildCommand || defaultConfig.buildCommand,
      entrypoint: parsed.t3code?.entrypoint || defaultConfig.entrypoint
    };
  } catch {
    cachedConfig = defaultConfig;
  }
  return cachedConfig;
}

// src/main/t3code/T3CodeManager.ts
var runtimes = /* @__PURE__ */ new Map();
var pendingStarts = /* @__PURE__ */ new Map();
var pendingStops = /* @__PURE__ */ new Map();
function reserveLoopbackPort() {
  const server = import_net.default.createServer();
  return new Promise((resolve2, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to reserve loopback port"));
        return;
      }
      const port = address.port;
      server.close(() => resolve2(port));
    });
  });
}
async function getFreePort() {
  return reserveLoopbackPort();
}
function getLatestModifiedTime(targetPath) {
  if (!(0, import_fs2.existsSync)(targetPath)) {
    return 0;
  }
  const stats = (0, import_fs2.statSync)(targetPath);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }
  let latest = stats.mtimeMs;
  for (const entry of (0, import_fs2.readdirSync)(targetPath, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
      continue;
    }
    latest = Math.max(latest, getLatestModifiedTime((0, import_path2.join)(targetPath, entry.name)));
  }
  return latest;
}
function shouldRebuild(sourcePath, entrypointPath) {
  if (!(0, import_fs2.existsSync)(entrypointPath)) {
    return true;
  }
  const webDistPath = (0, import_path2.join)(sourcePath, "apps", "web", "dist", "index.html");
  if (!(0, import_fs2.existsSync)(webDistPath)) {
    return true;
  }
  const latestSourceChange = Math.max(
    getLatestModifiedTime((0, import_path2.join)(sourcePath, "package.json")),
    getLatestModifiedTime((0, import_path2.join)(sourcePath, "apps", "web", "src")),
    getLatestModifiedTime((0, import_path2.join)(sourcePath, "apps", "web", "index.html")),
    getLatestModifiedTime((0, import_path2.join)(sourcePath, "apps", "server", "src"))
  );
  const latestBuildOutput = Math.min(
    (0, import_fs2.statSync)(entrypointPath).mtimeMs,
    (0, import_fs2.statSync)(webDistPath).mtimeMs
  );
  return latestSourceChange > latestBuildOutput;
}
function ensureBuilt(sourcePath, installCommand, buildCommand) {
  const entrypointPath = (0, import_path2.join)(sourcePath, getT3CodeConfig().entrypoint);
  if (!shouldRebuild(sourcePath, entrypointPath)) {
    return;
  }
  const install = (0, import_child_process.spawnSync)("/bin/zsh", ["-lc", installCommand], {
    cwd: sourcePath,
    stdio: "inherit"
  });
  if (install.status !== 0) {
    throw new Error("Failed to install T3Code dependencies");
  }
  const build = (0, import_child_process.spawnSync)("/bin/zsh", ["-lc", buildCommand], {
    cwd: sourcePath,
    stdio: "inherit"
  });
  if (build.status !== 0) {
    throw new Error("Failed to build T3Code");
  }
}
async function waitForReady(url, timeoutMs = 3e4) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/global/health`);
      if (response.ok) return;
    } catch {
    }
    await new Promise((resolve2) => setTimeout(resolve2, 500));
  }
  throw new Error("Timed out waiting for T3Code to become ready");
}
async function waitForAppShell(url, timeoutMs = 3e4) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
    }
    await new Promise((resolve2) => setTimeout(resolve2, 250));
  }
  throw new Error("Timed out waiting for T3Code app shell");
}
function prepareLogPath(instanceId) {
  const logsDir = (0, import_path2.join)((0, import_os.homedir)(), ".centipede-dev", "t3code-logs");
  (0, import_fs2.mkdirSync)(logsDir, { recursive: true });
  return (0, import_path2.join)(logsDir, `${instanceId}.log`);
}
function resolveBootstrapThreadInfo(stateDir, projectPath) {
  const stateDbPath = (0, import_path2.join)(stateDir, "userdata", "state.sqlite");
  if (!(0, import_fs2.existsSync)(stateDbPath)) {
    return null;
  }
  const db2 = new import_better_sqlite3.default(stateDbPath, { readonly: true });
  try {
    const row = db2.prepare(
      `SELECT t.thread_id AS threadId, t.title AS title
         FROM projection_threads t
         INNER JOIN projection_projects p ON p.project_id = t.project_id
         WHERE p.workspace_root = ? AND t.deleted_at IS NULL
         ORDER BY COALESCE(t.updated_at, t.created_at) DESC
         LIMIT 1`
    ).get(projectPath);
    if (!row?.threadId || !row.title) {
      return null;
    }
    return {
      threadId: row.threadId,
      title: row.title
    };
  } catch {
    return null;
  } finally {
    db2.close();
  }
}
function getT3CodeThreadInfo(instanceId, projectPath) {
  const runtime = runtimes.get(instanceId);
  const baseUrl = runtime?.url ?? null;
  const stateDir = (0, import_path2.join)((0, import_os.homedir)(), ".centipede-dev", "t3code-state", instanceId);
  const threadInfo = resolveBootstrapThreadInfo(stateDir, projectPath);
  if (!threadInfo) {
    return {
      url: baseUrl,
      threadTitle: null
    };
  }
  return {
    url: baseUrl ? new URL(`/${threadInfo.threadId}`, `${baseUrl}/`).toString() : null,
    threadTitle: threadInfo.title
  };
}
async function waitForBootstrapThreadInfo(baseUrl, stateDir, projectPath, timeoutMs = 5e3) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const threadInfo = resolveBootstrapThreadInfo(stateDir, projectPath);
    if (threadInfo) {
      return {
        url: new URL(`/${threadInfo.threadId}`, `${baseUrl}/`).toString(),
        threadTitle: threadInfo.title
      };
    }
    await new Promise((resolve2) => setTimeout(resolve2, 200));
  }
  return { url: baseUrl, threadTitle: null };
}
async function startT3Code(instanceId, projectPath) {
  const pendingStop = pendingStops.get(instanceId);
  if (pendingStop) {
    clearTimeout(pendingStop);
    pendingStops.delete(instanceId);
  }
  const existing = runtimes.get(instanceId);
  if (existing && existing.process.exitCode === null) {
    const threadInfo = await waitForBootstrapThreadInfo(
      existing.url,
      (0, import_path2.join)((0, import_os.homedir)(), ".centipede-dev", "t3code-state", instanceId),
      existing.projectPath,
      1500
    );
    return { url: threadInfo.url, logPath: existing.logPath, threadTitle: threadInfo.threadTitle };
  }
  const pending = pendingStarts.get(instanceId);
  if (pending) {
    return pending;
  }
  const config = getT3CodeConfig();
  if (!(0, import_fs2.existsSync)(config.sourcePath)) {
    throw new Error(`T3Code source not found at ${config.sourcePath}`);
  }
  const startPromise = (async () => {
    ensureBuilt(config.sourcePath, config.installCommand, config.buildCommand);
    const port = await getFreePort();
    const url = `http://127.0.0.1:${port}`;
    const entrypoint = (0, import_path2.join)(config.sourcePath, config.entrypoint);
    const logPath = prepareLogPath(instanceId);
    (0, import_fs2.mkdirSync)((0, import_path2.dirname)(logPath), { recursive: true });
    const logFd = (0, import_fs2.openSync)(logPath, "a");
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.T3CODE_AUTH_TOKEN;
    env.T3CODE_MODE = "web";
    env.T3CODE_HOST = "127.0.0.1";
    env.T3CODE_PORT = String(port);
    env.T3CODE_NO_BROWSER = "1";
    env.T3CODE_HOME = (0, import_path2.join)((0, import_os.homedir)(), ".centipede-dev", "t3code-state", instanceId);
    env.T3CODE_STATE_DIR = env.T3CODE_HOME;
    (0, import_fs2.mkdirSync)(env.T3CODE_HOME, { recursive: true });
    const child = (0, import_child_process.spawn)("node", [
      entrypoint,
      "--mode",
      "web",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--home-dir",
      env.T3CODE_HOME,
      "--auth-token",
      "",
      "--no-browser",
      "--auto-bootstrap-project-from-cwd"
    ], {
      cwd: projectPath,
      env,
      stdio: ["ignore", logFd, logFd]
    });
    child.on("exit", () => {
      runtimes.delete(instanceId);
      pendingStarts.delete(instanceId);
      (0, import_fs2.closeSync)(logFd);
    });
    runtimes.set(instanceId, {
      process: child,
      url,
      instanceId,
      projectPath,
      logPath
    });
    try {
      await waitForReady(url);
      await waitForAppShell(url);
      await new Promise((resolve2) => setTimeout(resolve2, 350));
      const threadInfo = await waitForBootstrapThreadInfo(url, env.T3CODE_HOME, projectPath);
      return { url: threadInfo.url, logPath, threadTitle: threadInfo.threadTitle };
    } catch (error) {
      child.kill();
      runtimes.delete(instanceId);
      throw error;
    } finally {
      pendingStarts.delete(instanceId);
    }
  })();
  pendingStarts.set(instanceId, startPromise);
  return startPromise;
}
function stopT3Code(instanceId) {
  if (pendingStops.has(instanceId)) return;
  const timer = setTimeout(() => {
    pendingStops.delete(instanceId);
    const instance = runtimes.get(instanceId);
    if (!instance) return;
    instance.process.kill();
    runtimes.delete(instanceId);
  }, 1500);
  pendingStops.set(instanceId, timer);
}
function stopAllT3Code() {
  for (const [, timer] of pendingStops) {
    clearTimeout(timer);
  }
  pendingStops.clear();
  for (const [instanceId, instance] of runtimes) {
    instance.process.kill();
    runtimes.delete(instanceId);
  }
}

// src/dev-server/index.ts
var dataDir = (0, import_path3.join)((0, import_os2.homedir)(), ".centipede-dev");
if (!(0, import_fs3.existsSync)(dataDir)) (0, import_fs3.mkdirSync)(dataDir, { recursive: true });
var dbPath = (0, import_path3.join)(dataDir, "centipede-dev.db");
var db = new import_better_sqlite32.default(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
var migrationsDir = (0, import_path3.join)(__dirname, "..", "main", "db", "migrations");
var srcMigrationsDir = (0, import_path3.join)(
  process.cwd(),
  "src",
  "main",
  "db",
  "migrations"
);
var mDir = (0, import_fs3.existsSync)(migrationsDir) ? migrationsDir : srcMigrationsDir;
if ((0, import_fs3.existsSync)(mDir)) {
  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r) => r.name)
  );
  const files = (0, import_fs3.readdirSync)(mDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = (0, import_fs3.readFileSync)((0, import_path3.join)(mDir, file), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
    console.log(`Applied migration: ${file}`);
  }
}
function rowToProject(row) {
  return {
    id: row.id,
    name: row.name,
    repoPath: row.repo_path,
    description: row.description,
    progress: row.progress,
    gitWorkspacesEnabled: Boolean(row.git_workspaces_enabled),
    defaultBrowserCookiePolicy: row.default_browser_cookie_policy,
    defaultTerminalMode: row.default_terminal_mode,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function rowToTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function rowToWorkspace(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    layoutState: JSON.parse(row.layout_state),
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function listWorkspacesForProject(args) {
  const projectId = typeof args === "string" ? args : args.projectId;
  const includeArchived = typeof args === "string" ? false : Boolean(args.includeArchived);
  return db.prepare(
    includeArchived ? "SELECT * FROM workspaces WHERE project_id = ? ORDER BY archived ASC, created_at ASC" : "SELECT * FROM workspaces WHERE project_id = ? AND archived = 0 ORDER BY created_at ASC"
  ).all(projectId).map(rowToWorkspace);
}
var ptys = /* @__PURE__ */ new Map();
function getShell() {
  if (process.platform === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/zsh";
}
function selectDirectoryInBrowserMode() {
  try {
    if (process.platform === "darwin") {
      const output = (0, import_child_process2.execFileSync)(
        "osascript",
        [
          "-e",
          'POSIX path of (choose folder with prompt "Select a project folder")'
        ],
        { encoding: "utf8" }
      );
      const directory = output.trim();
      return directory.length > 0 ? directory.replace(/\/$/, "") : null;
    }
    if (process.platform === "linux") {
      const output = (0, import_child_process2.execFileSync)(
        "zenity",
        ["--file-selection", "--directory", "--title=Select a project folder"],
        { encoding: "utf8" }
      );
      const directory = output.trim();
      return directory.length > 0 ? directory : null;
    }
    if (process.platform === "win32") {
      const output = (0, import_child_process2.execFileSync)(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
        ],
        { encoding: "utf8" }
      );
      const directory = output.trim();
      return directory.length > 0 ? directory : null;
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    if (!details.includes("execution error: User canceled")) {
      console.warn(`[dev-server] Failed to open directory picker: ${details}`);
    }
  }
  return null;
}
var handlers = {
  "project:list": () => {
    return db.prepare(
      "SELECT * FROM projects WHERE archived = 0 ORDER BY updated_at DESC"
    ).all().map(rowToProject);
  },
  "project:get": (id) => {
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return row ? rowToProject(row) : null;
  },
  "project:create": (input) => {
    const id = nanoid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(
      `INSERT INTO projects (id, name, repo_path, description, git_workspaces_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.repoPath,
      input.description || "",
      input.gitWorkspacesEnabled ? 1 : 0,
      now,
      now
    );
    return rowToProject(
      db.prepare("SELECT * FROM projects WHERE id = ?").get(id)
    );
  },
  "project:update": (input) => {
    const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(input.id);
    if (!existing) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updates = ["updated_at = ?"];
    const values = [now];
    if (input.name !== void 0) {
      updates.push("name = ?");
      values.push(input.name);
    }
    if (input.description !== void 0) {
      updates.push("description = ?");
      values.push(input.description);
    }
    if (input.progress !== void 0) {
      updates.push("progress = ?");
      values.push(input.progress);
    }
    if (input.gitWorkspacesEnabled !== void 0) {
      updates.push("git_workspaces_enabled = ?");
      values.push(input.gitWorkspacesEnabled ? 1 : 0);
    }
    if (input.defaultBrowserCookiePolicy !== void 0) {
      updates.push("default_browser_cookie_policy = ?");
      values.push(input.defaultBrowserCookiePolicy);
    }
    if (input.defaultTerminalMode !== void 0) {
      updates.push("default_terminal_mode = ?");
      values.push(input.defaultTerminalMode);
    }
    if (input.archived !== void 0) {
      updates.push("archived = ?");
      values.push(input.archived ? 1 : 0);
    }
    values.push(input.id);
    db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(
      ...values
    );
    return rowToProject(
      db.prepare("SELECT * FROM projects WHERE id = ?").get(input.id)
    );
  },
  "project:delete": (id) => {
    const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return result.changes > 0;
  },
  "task:list": (projectId) => {
    return db.prepare(
      "SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC"
    ).all(projectId).map(rowToTask);
  },
  "task:create": (input) => {
    const id = nanoid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(
      `INSERT INTO tasks (id, project_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.projectId, input.title, now, now);
    return rowToTask(db.prepare("SELECT * FROM tasks WHERE id = ?").get(id));
  },
  "task:toggle": (id) => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(
      `UPDATE tasks SET completed = NOT completed, updated_at = ? WHERE id = ?`
    ).run(now, id);
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    return row ? rowToTask(row) : null;
  },
  "task:update": (args) => {
    const [id, title] = Array.isArray(args) ? args : [args.id, args.title];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("UPDATE tasks SET title = ?, updated_at = ? WHERE id = ?").run(
      title,
      now,
      id
    );
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    return row ? rowToTask(row) : null;
  },
  "task:delete": (id) => {
    const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return result.changes > 0;
  },
  "workspace:list": (args) => {
    return listWorkspacesForProject(args);
  },
  "workspace:create": (input) => {
    const id = nanoid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const defaultLayout = JSON.stringify(input.layoutState ?? { panels: [], sizes: [] });
    db.prepare(
      `INSERT INTO workspaces (id, project_id, name, layout_state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.projectId, input.name, defaultLayout, now, now);
    return rowToWorkspace(
      db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id)
    );
  },
  "workspace:update": (input) => {
    const existing = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(input.id);
    if (!existing) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updates = ["updated_at = ?"];
    const values = [now];
    if (input.name !== void 0) {
      updates.push("name = ?");
      values.push(input.name);
    }
    if (input.archived !== void 0) {
      updates.push("archived = ?");
      values.push(input.archived ? 1 : 0);
    }
    if (updates.length === 1) {
      return rowToWorkspace(existing);
    }
    values.push(input.id);
    const result = db.prepare(`UPDATE workspaces SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    if (result.changes === 0) {
      return null;
    }
    return rowToWorkspace(
      db.prepare("SELECT * FROM workspaces WHERE id = ?").get(input.id)
    );
  },
  "workspace:update-layout": (input) => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = db.prepare("UPDATE workspaces SET layout_state = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(input.layoutState), now, input.id);
    return result.changes > 0;
  },
  "workspace:archive": (id) => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = db.prepare(
      "UPDATE workspaces SET archived = 1, updated_at = ? WHERE id = ?"
    ).run(now, id);
    return result.changes > 0;
  },
  "workspace:unarchive": (id) => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = db.prepare(
      "UPDATE workspaces SET archived = 0, updated_at = ? WHERE id = ?"
    ).run(now, id);
    return result.changes > 0;
  },
  "workspace:delete": (id) => {
    const result = db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    return result.changes > 0;
  },
  "dialog:select-directory": () => {
    return selectDirectoryInBrowserMode();
  },
  "terminal:create": (args, ws) => {
    const shell = getShell();
    const safeCwd = (0, import_fs3.existsSync)(args.cwd) ? args.cwd : (0, import_os2.homedir)();
    const env = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== void 0 && k !== "ELECTRON_RUN_AS_NODE") {
        env[k] = v;
      }
    }
    env.TERM = "xterm-256color";
    env.COLORTERM = "truecolor";
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: safeCwd,
      env
    });
    ptyProcess.onData((data) => {
      if (ws.readyState === import_ws.WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "terminal:data",
            id: args.id,
            data
          })
        );
      }
    });
    ptyProcess.onExit(({ exitCode }) => {
      if (ws.readyState === import_ws.WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "terminal:exit",
            id: args.id,
            exitCode
          })
        );
      }
      ptys.delete(args.id);
    });
    ptys.set(args.id, {
      pty: ptyProcess,
      projectId: args.projectId,
      workspaceId: args.workspaceId,
      ws
    });
    return { id: args.id, pid: ptyProcess.pid };
  },
  "terminal:write": (args) => {
    const instance = ptys.get(args.id);
    if (instance) instance.pty.write(args.data);
  },
  "terminal:resize": (args) => {
    const instance = ptys.get(args.id);
    if (instance) instance.pty.resize(args.cols, args.rows);
  },
  "terminal:close": (args) => {
    const instance = ptys.get(args.id);
    if (instance) {
      instance.pty.kill();
      ptys.delete(args.id);
    }
  },
  "t3code:start": async (args) => {
    const resolvedInstanceId = args.instanceId ?? args.workspaceId;
    if (!resolvedInstanceId) {
      throw new Error("Missing T3Code panel instance id");
    }
    return startT3Code(resolvedInstanceId, args.projectPath);
  },
  "t3code:stop": (payload) => {
    const resolvedInstanceId = typeof payload === "string" ? payload : payload.instanceId ?? payload.workspaceId;
    if (!resolvedInstanceId) {
      throw new Error("Missing T3Code panel instance id");
    }
    stopT3Code(resolvedInstanceId);
  },
  "t3code:get-thread-info": (args) => {
    const resolvedInstanceId = args.instanceId ?? args.workspaceId;
    if (!resolvedInstanceId) {
      throw new Error("Missing T3Code panel instance id");
    }
    return getT3CodeThreadInfo(resolvedInstanceId, args.projectPath);
  }
};
var PORT = 3001;
var wss = new import_ws.WebSocketServer({ port: PORT });
wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const { id, channel, args } = msg;
      const handler = handlers[channel];
      if (!handler) {
        ws.send(
          JSON.stringify({
            id,
            error: `No handler for channel: ${channel}`
          })
        );
        return;
      }
      try {
        const result = await Promise.resolve(handler(args, ws));
        ws.send(JSON.stringify({ id, result }));
      } catch (err) {
        ws.send(JSON.stringify({ id, error: err.message }));
      }
    } catch {
      console.error("Invalid message:", raw.toString().slice(0, 200));
    }
  });
  ws.on("close", () => {
    console.log("Client disconnected");
    for (const [id, instance] of ptys) {
      if (instance.ws === ws) {
        instance.pty.kill();
        ptys.delete(id);
      }
    }
  });
});
console.log(`
  \u{1F41B} Centipede dev server running on ws://localhost:${PORT}`);
console.log(`     Database: ${dbPath}`);
console.log(`     Open http://localhost:5173 in your browser
`);
process.on("SIGINT", () => {
  for (const [, instance] of ptys) {
    instance.pty.kill();
  }
  stopAllT3Code();
  db.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  for (const [, instance] of ptys) {
    instance.pty.kill();
  }
  stopAllT3Code();
  db.close();
  process.exit(0);
});
