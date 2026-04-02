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
var import_ws2 = require("ws");
var import_better_sqlite32 = __toESM(require("better-sqlite3"));
var import_child_process2 = require("child_process");
var import_node_http = __toESM(require("node:http"));
var import_path4 = require("path");
var import_fs3 = require("fs");
var import_os3 = require("os");

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
var import_node_crypto2 = require("node:crypto");

// src/main/t3code/T3CodeManager.ts
var import_child_process = require("child_process");
var import_fs2 = require("fs");
var import_os2 = require("os");
var import_path3 = require("path");
var import_net = __toESM(require("net"));
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var import_ws = __toESM(require("ws"));
var import_electron2 = require("electron");

// src/shared/ipc-channels.ts
var T3CODE_CHANNELS = {
  ENSURE_RUNTIME: "t3code:ensure-runtime",
  ENSURE_PROJECT: "t3code:ensure-project",
  ENSURE_PANEL_THREAD: "t3code:ensure-panel-thread",
  GET_THREAD_INFO: "t3code:get-thread-info",
  WATCH_THREAD: "t3code:watch-thread",
  UNWATCH_THREAD: "t3code:unwatch-thread",
  THREAD_INFO_CHANGED: "t3code:thread-info-changed"
};
var BROWSER_CHANNELS = {
  NAVIGATE: "browser:navigate",
  OPEN: "browser:open",
  OPEN_TEMPORARY: "browser:open-temporary",
  CLOSE: "browser:close",
  SNAPSHOT: "browser:snapshot",
  RESIZE: "browser:resize",
  ACTIVATE: "browser:activate",
  LIST: "browser:list",
  GET: "browser:get",
  SESSION: "browser:session",
  SESSION_SYNC: "browser:session-sync",
  URL_CHANGED: "browser:url-changed",
  FOCUS_CHANGED: "browser:focus-changed",
  WEBVIEW_READY: "browser:webview-ready",
  WEBVIEW_DESTROYED: "browser:webview-destroyed",
  CAPTURE_PREVIEW: "browser:capture-preview",
  AUTOMATION_STATE_CHANGED: "browser:automation-state-changed"
};

// src/main/t3code/config.ts
var import_fs = require("fs");
var import_path = require("path");
var T3CODE_ENTRYPOINT_CANDIDATES = [
  "apps/server/dist/bin.mjs",
  "apps/server/dist/index.mjs"
];
function findProjectRoot() {
  const candidates = [
    process.cwd(),
    __dirname,
    (0, import_path.dirname)(require.main?.filename ?? process.cwd())
  ];
  for (const candidate of candidates) {
    let current = (0, import_path.resolve)(candidate);
    while (true) {
      const configPath = (0, import_path.join)(current, "spectrum.config.json");
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
function getPackagedT3CodePath() {
  const resourcesPath = process.resourcesPath;
  if (!resourcesPath) {
    return null;
  }
  const candidate = (0, import_path.join)(resourcesPath, "t3code");
  return (0, import_fs.existsSync)((0, import_path.join)(candidate, "package.json")) ? candidate : null;
}
function findExistingT3CodeSourcePath(preferredPath) {
  const candidates = [
    preferredPath,
    getPackagedT3CodePath(),
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
function resolveT3CodeEntrypoint(sourcePath, preferredEntrypoint) {
  const candidates = [
    preferredEntrypoint,
    ...T3CODE_ENTRYPOINT_CANDIDATES
  ].filter((value) => Boolean(value));
  for (const candidate of candidates) {
    if ((0, import_fs.existsSync)((0, import_path.join)(sourcePath, candidate))) {
      return candidate;
    }
  }
  return preferredEntrypoint ?? T3CODE_ENTRYPOINT_CANDIDATES[0];
}
var defaultSourcePath = findExistingT3CodeSourcePath(
  (0, import_path.join)(projectRoot, "resources", "t3code")
);
var defaultConfig = {
  sourcePath: defaultSourcePath,
  installCommand: "bun install --frozen-lockfile",
  buildCommand: "bun run --cwd apps/web build && bun run --cwd apps/server build",
  entrypoint: resolveT3CodeEntrypoint(defaultSourcePath)
};
var cachedConfig = null;
function getT3CodeConfig() {
  if (cachedConfig) return cachedConfig;
  const configPath = (0, import_path.join)(projectRoot, "spectrum.config.json");
  if (!(0, import_fs.existsSync)(configPath)) {
    cachedConfig = defaultConfig;
    return cachedConfig;
  }
  try {
    const parsed = JSON.parse(
      (0, import_fs.readFileSync)(configPath, "utf8")
    );
    const sourcePath = findExistingT3CodeSourcePath(
      parsed.t3code?.sourcePath ? (0, import_path.resolve)(projectRoot, parsed.t3code.sourcePath) : defaultConfig.sourcePath
    );
    cachedConfig = {
      sourcePath,
      installCommand: parsed.t3code?.installCommand || defaultConfig.installCommand,
      buildCommand: parsed.t3code?.buildCommand || defaultConfig.buildCommand,
      entrypoint: resolveT3CodeEntrypoint(
        sourcePath,
        parsed.t3code?.entrypoint || defaultConfig.entrypoint
      )
    };
  } catch {
    cachedConfig = defaultConfig;
  }
  return cachedConfig;
}

// src/main/browser-cli/BrowserCliPathManager.ts
var import_electron = require("electron");
var import_os = require("os");
var import_path2 = require("path");
function getProjectRoot() {
  if (typeof import_electron.app?.getAppPath === "function") {
    return import_electron.app.getAppPath();
  }
  return process.cwd();
}
function getUserDataPath() {
  if (typeof import_electron.app?.getPath === "function") {
    return import_electron.app.getPath("userData");
  }
  return (0, import_path2.join)((0, import_os.homedir)(), ".spectrum-dev");
}
function getBrowserCliRoot() {
  if (typeof import_electron.app?.isPackaged === "boolean" && import_electron.app.isPackaged) {
    return (0, import_path2.join)(process.resourcesPath, "browser-cli");
  }
  return (0, import_path2.join)(getProjectRoot(), "resources", "browser-cli");
}
function getBrowserCliBinDir() {
  return (0, import_path2.join)(getBrowserCliRoot(), "bin");
}
function getBrowserCommandPath() {
  if (process.platform === "win32") {
    return (0, import_path2.join)(getBrowserCliBinDir(), "browser.js");
  }
  return (0, import_path2.join)(getBrowserCliBinDir(), "browser");
}
function getBrowserCliCommandPath() {
  if (process.platform === "win32") {
    return (0, import_path2.join)(getBrowserCliBinDir(), "browser-cli.js");
  }
  return (0, import_path2.join)(getBrowserCliBinDir(), "browser-cli");
}
function getBrowserCliSessionFilePath() {
  return (0, import_path2.join)(getUserDataPath(), "browser-cli", "sessions.json");
}
function getBrowserCliThreadBindingsFilePath() {
  return (0, import_path2.join)(getUserDataPath(), "browser-cli", "thread-bindings.json");
}
function prependBrowserCliToPath(existingPath) {
  const binDir = getBrowserCliBinDir();
  if (!existingPath) {
    return binDir;
  }
  return [binDir, ...existingPath.split(import_path2.delimiter).filter(Boolean)].join(import_path2.delimiter);
}

// src/main/t3code/T3CodeManager.ts
var GLOBAL_RUNTIME_ID = "global";
var DEFAULT_MODEL_SELECTION = {
  provider: "codex",
  model: "gpt-5.4"
};
var runtime = null;
var pendingRuntimeStart = null;
var pendingProjectEnsures = /* @__PURE__ */ new Map();
var pendingPanelThreadEnsures = /* @__PURE__ */ new Map();
var watchedThreadsByPanelId = /* @__PURE__ */ new Map();
var watchTimer = null;
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
function getFreePort() {
  return reserveLoopbackPort();
}
function getPackagedT3CodeRoot() {
  return (0, import_path3.join)(process.resourcesPath, "t3code");
}
function isPackagedT3CodeSource(sourcePath) {
  return (0, import_fs2.existsSync)(getPackagedT3CodeRoot()) && (0, import_path3.join)(sourcePath) === getPackagedT3CodeRoot() || (0, import_fs2.existsSync)((0, import_path3.join)(sourcePath, ".spectrum-packaged-t3code-runtime"));
}
function getPackagedT3CodeShadowRoot() {
  return (0, import_path3.join)((0, import_os2.homedir)(), ".spectrum-dev", "embedded", "t3code-runtime");
}
function getT3CodeAppShellPath(sourcePath) {
  return (0, import_path3.join)(sourcePath, "apps", "server", "dist", "client", "index.html");
}
function writeRuntimePackageManifest(targetPath, name) {
  (0, import_fs2.writeFileSync)(
    targetPath,
    JSON.stringify(
      {
        name,
        private: true,
        type: "module"
      },
      null,
      2
    )
  );
}
function readLogExcerpt(logPath, lineCount = 40) {
  if (!(0, import_fs2.existsSync)(logPath)) {
    return null;
  }
  try {
    const lines = (0, import_fs2.readFileSync)(logPath, "utf8").trim().split("\n");
    const excerpt = lines.slice(-lineCount).join("\n").trim();
    return excerpt.length > 0 ? excerpt : null;
  } catch {
    return null;
  }
}
function buildStartupErrorMessage(message, logPath) {
  const excerpt = readLogExcerpt(logPath);
  if (!excerpt) {
    return `${message}. See log: ${logPath}`;
  }
  return `${message}. See log: ${logPath}

Recent log output:
${excerpt}`;
}
function ensurePackagedT3CodeRuntimeReady() {
  const config = getT3CodeConfig();
  const packagedRoot = getPackagedT3CodeRoot();
  const shadowRoot = getPackagedT3CodeShadowRoot();
  const versionFile = (0, import_path3.join)(shadowRoot, ".version");
  const markerFile = (0, import_path3.join)(shadowRoot, ".spectrum-packaged-t3code-runtime");
  const currentVersion = import_electron2.app.getVersion();
  const shadowEntrypointPath = (0, import_path3.join)(shadowRoot, config.entrypoint);
  const shadowAppShellPath = getT3CodeAppShellPath(shadowRoot);
  const shadowNodeModulesPath = (0, import_path3.join)(shadowRoot, "node_modules");
  if ((0, import_fs2.existsSync)(shadowEntrypointPath) && (0, import_fs2.existsSync)(shadowAppShellPath) && (0, import_fs2.existsSync)(shadowNodeModulesPath) && (0, import_fs2.existsSync)(markerFile) && (0, import_fs2.existsSync)(versionFile) && (0, import_fs2.statSync)(versionFile).isFile()) {
    try {
      const version = (0, import_fs2.readFileSync)(versionFile, "utf8").trim();
      const nodeModulesStats = (0, import_fs2.lstatSync)(shadowNodeModulesPath);
      if (version === currentVersion && !nodeModulesStats.isSymbolicLink()) {
        return shadowRoot;
      }
    } catch {
    }
  }
  (0, import_fs2.rmSync)(shadowRoot, { recursive: true, force: true });
  (0, import_fs2.mkdirSync)((0, import_path3.join)(shadowRoot, "apps", "server"), { recursive: true });
  const packagedRootPackagePath = (0, import_path3.join)(packagedRoot, "package.json");
  const packagedServerPackagePath = (0, import_path3.join)(packagedRoot, "apps", "server", "package.json");
  if ((0, import_fs2.existsSync)(packagedRootPackagePath)) {
    (0, import_fs2.copyFileSync)(packagedRootPackagePath, (0, import_path3.join)(shadowRoot, "package.json"));
  } else {
    writeRuntimePackageManifest((0, import_path3.join)(shadowRoot, "package.json"), "@spectrum/t3code-runtime");
  }
  if ((0, import_fs2.existsSync)(packagedServerPackagePath)) {
    (0, import_fs2.copyFileSync)(packagedServerPackagePath, (0, import_path3.join)(shadowRoot, "apps", "server", "package.json"));
  } else {
    writeRuntimePackageManifest(
      (0, import_path3.join)(shadowRoot, "apps", "server", "package.json"),
      "@spectrum/t3code-server-runtime"
    );
  }
  (0, import_fs2.cpSync)(
    (0, import_path3.join)(packagedRoot, "apps", "server", "dist"),
    (0, import_path3.join)(shadowRoot, "apps", "server", "dist"),
    { recursive: true }
  );
  (0, import_fs2.cpSync)((0, import_path3.join)(packagedRoot, "runtime-node-modules"), (0, import_path3.join)(shadowRoot, "node_modules"), {
    recursive: true,
    dereference: true
  });
  (0, import_fs2.writeFileSync)(markerFile, "");
  (0, import_fs2.writeFileSync)(versionFile, currentVersion);
  return shadowRoot;
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
    latest = Math.max(latest, getLatestModifiedTime((0, import_path3.join)(targetPath, entry.name)));
  }
  return latest;
}
function shouldRebuild(sourcePath, entrypointPath) {
  if (isPackagedT3CodeSource(sourcePath)) {
    return false;
  }
  if (!(0, import_fs2.existsSync)(entrypointPath)) {
    return true;
  }
  const webDistPath = (0, import_path3.join)(sourcePath, "apps", "web", "dist", "index.html");
  if (!(0, import_fs2.existsSync)(webDistPath)) {
    return true;
  }
  const latestSourceChange = Math.max(
    getLatestModifiedTime((0, import_path3.join)(sourcePath, "package.json")),
    getLatestModifiedTime((0, import_path3.join)(sourcePath, "apps", "web", "src")),
    getLatestModifiedTime((0, import_path3.join)(sourcePath, "apps", "web", "index.html")),
    getLatestModifiedTime((0, import_path3.join)(sourcePath, "apps", "server", "src"))
  );
  const latestBuildOutput = Math.min(
    (0, import_fs2.statSync)(entrypointPath).mtimeMs,
    (0, import_fs2.statSync)(webDistPath).mtimeMs
  );
  return latestSourceChange > latestBuildOutput;
}
function getLatestBuildOutputTime(sourcePath, entrypointPath) {
  const webDistPath = (0, import_path3.join)(sourcePath, "apps", "web", "dist", "index.html");
  return Math.max(
    (0, import_fs2.existsSync)(entrypointPath) ? (0, import_fs2.statSync)(entrypointPath).mtimeMs : 0,
    (0, import_fs2.existsSync)(webDistPath) ? (0, import_fs2.statSync)(webDistPath).mtimeMs : 0
  );
}
async function stopRuntimeInstance(instance) {
  if (instance.process.exitCode !== null) {
    return;
  }
  await new Promise((resolve2) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      instance.process.removeListener("exit", finish);
      resolve2();
    };
    instance.process.once("exit", finish);
    try {
      instance.process.kill();
    } catch {
      finish();
      return;
    }
    setTimeout(finish, 5e3);
  });
}
function ensureBuilt(sourcePath, installCommand, buildCommand) {
  if (import_electron2.app.isPackaged || isPackagedT3CodeSource(sourcePath)) {
    return;
  }
  const entrypointPath = (0, import_path3.join)(sourcePath, getT3CodeConfig().entrypoint);
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
async function waitForReady(baseUrl, timeoutMs = 3e4) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/global/health`);
      if (response.ok) {
        return;
      }
    } catch {
    }
    await new Promise((resolve2) => setTimeout(resolve2, 500));
  }
  throw new Error("Timed out waiting for T3Code to become ready");
}
async function waitForAppShell(baseUrl, timeoutMs = 3e4) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
    }
    await new Promise((resolve2) => setTimeout(resolve2, 250));
  }
  throw new Error("Timed out waiting for T3Code app shell");
}
async function waitForWebSocketReady(baseUrl, timeoutMs = 1e4) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      await sendWsRequest(baseUrl, { _tag: "orchestration.getSnapshot" });
      return;
    } catch {
    }
    await new Promise((resolve2) => setTimeout(resolve2, 200));
  }
  throw new Error("Timed out waiting for T3Code websocket readiness");
}
function getStateDir() {
  return (0, import_path3.join)((0, import_os2.homedir)(), ".spectrum-dev", "t3code-state", GLOBAL_RUNTIME_ID);
}
function getLogPath() {
  const logsDir = (0, import_path3.join)((0, import_os2.homedir)(), ".spectrum-dev", "t3code-logs");
  (0, import_fs2.mkdirSync)(logsDir, { recursive: true });
  return (0, import_path3.join)(logsDir, `${GLOBAL_RUNTIME_ID}.log`);
}
function closeFileDescriptor(fd) {
  try {
    (0, import_fs2.closeSync)(fd);
  } catch {
  }
}
function getPackagedNodeBinaryPath() {
  return (0, import_path3.join)(process.resourcesPath, "node-bin", process.platform === "win32" ? "node.exe" : "node");
}
function resolveT3CodeRuntimeCommand() {
  const packagedNodePath = getPackagedNodeBinaryPath();
  if ((0, import_fs2.existsSync)(packagedNodePath)) {
    return packagedNodePath;
  }
  return "node";
}
function getStateDbPath(stateDir = getStateDir()) {
  return (0, import_path3.join)(stateDir, "userdata", "state.sqlite");
}
function openStateDb(options) {
  const stateDbPath = getStateDbPath();
  if (!(0, import_fs2.existsSync)(stateDbPath)) {
    return null;
  }
  return new import_better_sqlite3.default(stateDbPath, options);
}
function getProjectBindingId(spectrumProjectId) {
  return `spectrum-project:${spectrumProjectId}`;
}
function resolveT3ProjectBindingId(spectrumProjectId, existingT3ProjectId) {
  const expectedBindingId = getProjectBindingId(spectrumProjectId);
  if (existingT3ProjectId === expectedBindingId) {
    return existingT3ProjectId;
  }
  return expectedBindingId;
}
function parseModelSelection(raw) {
  if (!raw) {
    return DEFAULT_MODEL_SELECTION;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
  }
  return DEFAULT_MODEL_SELECTION;
}
function getProjectById(projectId) {
  const db2 = openStateDb({ readonly: true });
  if (!db2) {
    return null;
  }
  try {
    return db2.prepare(
      `SELECT
             project_id AS projectId,
             title,
             workspace_root AS workspaceRoot,
             default_model_selection_json AS defaultModelSelectionJson
           FROM projection_projects
           WHERE project_id = ?
             AND deleted_at IS NULL`
    ).get(projectId) ?? null;
  } finally {
    db2.close();
  }
}
function getThreadById(threadId) {
  const db2 = openStateDb({ readonly: true });
  if (!db2) {
    return null;
  }
  try {
    return db2.prepare(
      `SELECT
             thread_id AS threadId,
             project_id AS projectId,
             title,
             model_selection_json AS modelSelectionJson,
             deleted_at AS deletedAt
           FROM projection_threads
           WHERE thread_id = ?`
    ).get(threadId) ?? null;
  } finally {
    db2.close();
  }
}
function computeNotificationKind(input) {
  const { sessionStatus, pendingApprovalCount, hasPendingUserInput, latestTurnCompletedAt } = input;
  if (sessionStatus === "running" || sessionStatus === "connecting" || sessionStatus === "starting") {
    return null;
  }
  if (pendingApprovalCount > 0) {
    return "requires-input";
  }
  if (hasPendingUserInput) {
    return "requires-input";
  }
  if (latestTurnCompletedAt) {
    return "completed";
  }
  return null;
}
function getThreadMetadata(threadId) {
  const db2 = openStateDb({ readonly: true });
  if (!db2) {
    return {
      threadTitle: null,
      lastUserMessageAt: null,
      providerId: null,
      notificationKind: null
    };
  }
  try {
    const threadRow = db2.prepare(
      `SELECT
           title,
           model_selection_json AS modelSelectionJson
         FROM projection_threads
         WHERE thread_id = ?
           AND deleted_at IS NULL`
    ).get(threadId);
    const messageRow = db2.prepare(
      `SELECT created_at AS lastUserMessageAt
         FROM projection_thread_messages
         WHERE thread_id = ?
           AND role = 'user'
         ORDER BY created_at DESC
         LIMIT 1`
    ).get(threadId);
    let sessionStatus = null;
    try {
      const sessionRow = db2.prepare(
        `SELECT status FROM projection_thread_sessions WHERE thread_id = ? LIMIT 1`
      ).get(threadId);
      sessionStatus = sessionRow?.status ?? null;
    } catch {
    }
    let pendingApprovalCount = 0;
    try {
      const approvalRow = db2.prepare(
        `SELECT COUNT(*) as count FROM projection_pending_approvals WHERE thread_id = ? AND status = 'pending'`
      ).get(threadId);
      pendingApprovalCount = approvalRow?.count ?? 0;
    } catch {
    }
    let hasPendingUserInput = false;
    try {
      const activities = db2.prepare(
        `SELECT kind, payload_json AS payloadJson
           FROM projection_thread_activities
           WHERE thread_id = ?
             AND kind IN ('user-input.requested', 'user-input.responded')
           ORDER BY sequence ASC, created_at ASC`
      ).all(threadId);
      const requestedIds = /* @__PURE__ */ new Set();
      const respondedIds = /* @__PURE__ */ new Set();
      for (const activity of activities) {
        try {
          const payload = activity.payloadJson ? JSON.parse(activity.payloadJson) : null;
          const requestId = typeof payload?.requestId === "string" ? payload.requestId : null;
          if (!requestId) continue;
          if (activity.kind === "user-input.requested") {
            requestedIds.add(requestId);
          } else if (activity.kind === "user-input.responded") {
            respondedIds.add(requestId);
          }
        } catch {
        }
      }
      hasPendingUserInput = [...requestedIds].some((id) => !respondedIds.has(id));
    } catch {
    }
    let latestTurnCompletedAt = null;
    try {
      const turnRow = db2.prepare(
        `SELECT completed_at AS completedAt
           FROM projection_turns
           WHERE thread_id = ?
             AND completed_at IS NOT NULL
           ORDER BY completed_at DESC
           LIMIT 1`
      ).get(threadId);
      latestTurnCompletedAt = turnRow?.completedAt ?? null;
    } catch {
    }
    const notificationKind = computeNotificationKind({
      sessionStatus,
      pendingApprovalCount,
      hasPendingUserInput,
      latestTurnCompletedAt
    });
    return {
      threadTitle: threadRow?.title ?? null,
      lastUserMessageAt: messageRow?.lastUserMessageAt ?? null,
      providerId: getProviderIdFromModelSelection(threadRow?.modelSelectionJson),
      notificationKind
    };
  } finally {
    db2.close();
  }
}
function getProviderIdFromModelSelection(modelSelectionJson) {
  const parsed = parseModelSelection(modelSelectionJson);
  const providerId = parsed.provider;
  return typeof providerId === "string" && providerId.trim().length > 0 ? providerId : null;
}
function emitThreadInfoChanged(payload) {
  for (const window of import_electron2.BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(T3CODE_CHANNELS.THREAD_INFO_CHANGED, payload);
    }
  }
}
function isAppInteractive() {
  return import_electron2.BrowserWindow.getAllWindows().some((window) => window.isVisible() && window.isFocused());
}
function getWatchIntervalMs(priority) {
  if (priority === "focused") {
    return 2e3;
  }
  if (priority === "active") {
    return 1e4;
  }
  return 3e4;
}
async function pollWatchedThreads() {
  const now = Date.now();
  const appInteractive = isAppInteractive();
  for (const watch of watchedThreadsByPanelId.values()) {
    if (watch.priority === "inactive" && !appInteractive) {
      continue;
    }
    const intervalMs = getWatchIntervalMs(watch.priority);
    if (now - watch.lastPolledAt < intervalMs) {
      continue;
    }
    watch.lastPolledAt = now;
    const snapshot = getThreadMetadata(watch.t3ThreadId);
    if (watch.lastSnapshot?.threadTitle === snapshot.threadTitle && watch.lastSnapshot?.lastUserMessageAt === snapshot.lastUserMessageAt && watch.lastSnapshot?.providerId === snapshot.providerId && watch.lastSnapshot?.notificationKind === snapshot.notificationKind) {
      continue;
    }
    watch.lastSnapshot = snapshot;
    emitThreadInfoChanged({
      panelId: watch.panelId,
      t3ThreadId: watch.t3ThreadId,
      threadTitle: snapshot.threadTitle,
      lastUserMessageAt: snapshot.lastUserMessageAt,
      providerId: snapshot.providerId,
      notificationKind: snapshot.notificationKind
    });
  }
}
function ensureWatchTimer() {
  if (watchTimer || watchedThreadsByPanelId.size === 0) {
    return;
  }
  watchTimer = setInterval(() => {
    void pollWatchedThreads();
  }, 2e3);
}
function stopWatchTimerIfIdle() {
  if (watchTimer && watchedThreadsByPanelId.size === 0) {
    clearInterval(watchTimer);
    watchTimer = null;
  }
}
async function waitForProject(projectId, timeoutMs = 5e3) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const project = getProjectById(projectId);
    if (project) {
      return project;
    }
    await new Promise((resolve2) => setTimeout(resolve2, 100));
  }
  throw new Error(`Timed out waiting for T3Code project ${projectId}`);
}
async function waitForThread(threadId, timeoutMs = 5e3) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const thread = getThreadById(threadId);
    if (thread && !thread.deletedAt) {
      return thread;
    }
    await new Promise((resolve2) => setTimeout(resolve2, 100));
  }
  throw new Error(`Timed out waiting for T3Code thread ${threadId}`);
}
async function sendWsRequest(baseUrl, body) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < 1e4) {
    try {
      return await new Promise((resolve2, reject) => {
        const wsUrl = baseUrl.replace(/^http/, "ws");
        const socket = new import_ws.default(wsUrl);
        const requestId = `spectrum-${crypto.randomUUID()}`;
        let settled = false;
        const finish = (callback) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);
          socket.removeAllListeners();
          try {
            socket.close();
          } catch {
          }
          callback();
        };
        const timeout = setTimeout(() => {
          finish(
            () => reject(new Error(`Timed out waiting for T3Code websocket response: ${String(body._tag)}`))
          );
        }, 3e4);
        socket.on("open", () => {
          socket.send(
            JSON.stringify({
              id: requestId,
              body
            })
          );
        });
        socket.on("message", (raw) => {
          let parsed;
          try {
            parsed = JSON.parse(raw.toString());
          } catch {
            return;
          }
          if (parsed.type === "push" || parsed.id !== requestId) {
            return;
          }
          const errorMessage = parsed.error?.message;
          if (errorMessage) {
            finish(() => reject(new Error(errorMessage)));
            return;
          }
          finish(() => resolve2(parsed.result));
        });
        socket.on("error", (error) => {
          finish(() => reject(error));
        });
        socket.on("close", () => {
          if (!settled) {
            finish(() => reject(new Error("T3Code websocket connection closed unexpectedly")));
          }
        });
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!/ECONNREFUSED|closed unexpectedly/i.test(lastError.message) && !lastError.code?.includes?.("ECONNREFUSED")) {
        throw lastError;
      }
      await new Promise((resolve2) => setTimeout(resolve2, 200));
    }
  }
  throw lastError ?? new Error("Timed out connecting to T3Code websocket");
}
function buildEmbeddedThreadUrl(baseUrl, threadId) {
  return new URL(`/embed/thread/${threadId}`, `${baseUrl}/`).toString();
}
async function ensureRuntime() {
  const config = getT3CodeConfig();
  const sourcePath = import_electron2.app.isPackaged ? ensurePackagedT3CodeRuntimeReady() : isPackagedT3CodeSource(config.sourcePath) ? ensurePackagedT3CodeRuntimeReady() : config.sourcePath;
  if (!(0, import_fs2.existsSync)(sourcePath)) {
    throw new Error(`T3Code source not found at ${config.sourcePath}`);
  }
  const entrypointPath = (0, import_path3.join)(sourcePath, config.entrypoint);
  const activeRuntime = runtime && runtime.process.exitCode === null ? runtime : null;
  const needsRebuild = import_electron2.app.isPackaged ? false : shouldRebuild(sourcePath, entrypointPath);
  const latestBuildOutputTime = getLatestBuildOutputTime(sourcePath, entrypointPath);
  if (activeRuntime && !needsRebuild && latestBuildOutputTime <= activeRuntime.startedAt) {
    return { baseUrl: activeRuntime.baseUrl, logPath: activeRuntime.logPath };
  }
  if (pendingRuntimeStart) {
    return pendingRuntimeStart;
  }
  let startPromise = null;
  startPromise = (async () => {
    if (needsRebuild) {
      ensureBuilt(sourcePath, config.installCommand, config.buildCommand);
    }
    const rebuiltOutputTime = getLatestBuildOutputTime(sourcePath, entrypointPath);
    const previousRuntime = runtime && runtime.process.exitCode === null ? runtime : null;
    if (previousRuntime && rebuiltOutputTime <= previousRuntime.startedAt) {
      return { baseUrl: previousRuntime.baseUrl, logPath: previousRuntime.logPath };
    }
    if (previousRuntime) {
      await stopRuntimeInstance(previousRuntime);
    }
    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const entrypoint = entrypointPath;
    const stateDir = getStateDir();
    const logPath = getLogPath();
    (0, import_fs2.mkdirSync)(stateDir, { recursive: true });
    (0, import_fs2.mkdirSync)((0, import_path3.dirname)(logPath), { recursive: true });
    const logFd = (0, import_fs2.openSync)(logPath, "a");
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.T3CODE_AUTH_TOKEN;
    env.PATH = prependBrowserCliToPath(env.PATH);
    env.SPECTRUM_BROWSER = getBrowserCommandPath();
    env.SPECTRUM_BROWSER_CLI = getBrowserCliCommandPath();
    env.SPECTRUM_BROWSER_SESSION_FILE = getBrowserCliSessionFilePath();
    env.SPECTRUM_BROWSER_THREAD_BINDINGS_FILE = getBrowserCliThreadBindingsFilePath();
    env.T3CODE_MODE = "web";
    env.T3CODE_HOST = "127.0.0.1";
    env.T3CODE_PORT = String(port);
    env.T3CODE_NO_BROWSER = "1";
    env.T3CODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD = "0";
    env.T3CODE_HOME = stateDir;
    env.T3CODE_STATE_DIR = stateDir;
    const runtimeCommand = resolveT3CodeRuntimeCommand();
    if (runtimeCommand === process.execPath) {
      env.ELECTRON_RUN_AS_NODE = "1";
    } else {
      delete env.ELECTRON_RUN_AS_NODE;
    }
    const child = (0, import_child_process.spawn)(
      runtimeCommand,
      [
        entrypoint,
        "--mode",
        "web",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--home-dir",
        stateDir,
        "--auth-token",
        "",
        "--no-browser"
      ],
      {
        cwd: sourcePath,
        env,
        stdio: ["ignore", logFd, logFd]
      }
    );
    let didChildError = false;
    const childStart = Promise.race([
      waitForReady(baseUrl).then(() => waitForAppShell(baseUrl)).then(() => waitForWebSocketReady(baseUrl)),
      new Promise((_, reject) => {
        child.once("error", (error) => {
          didChildError = true;
          reject(error);
        });
      }),
      new Promise((_, reject) => {
        child.once("exit", (code, signal) => {
          reject(
            new Error(
              buildStartupErrorMessage(
                signal ? `T3Code exited before becoming ready (signal ${signal})` : `T3Code exited before becoming ready (code ${code ?? "unknown"})`,
                logPath
              )
            )
          );
        });
      })
    ]);
    child.on("exit", () => {
      if (runtime?.process === child) {
        runtime = null;
      }
      if (pendingRuntimeStart === startPromise) {
        pendingRuntimeStart = null;
      }
      closeFileDescriptor(logFd);
    });
    runtime = {
      process: child,
      baseUrl,
      logPath,
      stateDir,
      startedAt: Date.now()
    };
    try {
      await childStart;
      return { baseUrl, logPath };
    } catch (error) {
      if (!didChildError && child.exitCode === null) {
        child.kill();
      }
      closeFileDescriptor(logFd);
      if (runtime?.process === child) {
        runtime = null;
      }
      if (error instanceof Error && !error.message.includes(logPath)) {
        throw new Error(buildStartupErrorMessage(error.message, logPath));
      }
      throw error;
    } finally {
      if (pendingRuntimeStart === startPromise) {
        pendingRuntimeStart = null;
      }
    }
  })();
  pendingRuntimeStart = startPromise;
  return pendingRuntimeStart;
}
async function ensureT3Project(input) {
  const t3ProjectId = resolveT3ProjectBindingId(
    input.spectrumProjectId,
    input.existingT3ProjectId
  );
  const pendingKey = t3ProjectId;
  const pending = pendingProjectEnsures.get(pendingKey);
  if (pending) {
    return pending;
  }
  const ensurePromise = (async () => {
    const { baseUrl } = await ensureRuntime();
    const existing = getProjectById(t3ProjectId);
    if (existing) {
      if (existing.workspaceRoot !== input.projectPath || existing.title !== input.projectName) {
        await sendWsRequest(baseUrl, {
          _tag: "orchestration.dispatchCommand",
          command: {
            type: "project.meta.update",
            commandId: crypto.randomUUID(),
            projectId: t3ProjectId,
            title: input.projectName,
            workspaceRoot: input.projectPath
          }
        });
        await waitForProject(t3ProjectId);
      }
      return { t3ProjectId };
    }
    try {
      await sendWsRequest(baseUrl, {
        _tag: "orchestration.dispatchCommand",
        command: {
          type: "project.create",
          commandId: crypto.randomUUID(),
          projectId: t3ProjectId,
          title: input.projectName,
          workspaceRoot: input.projectPath,
          defaultModelSelection: DEFAULT_MODEL_SELECTION,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists and cannot be created twice/i.test(message)) {
        throw error;
      }
    }
    await waitForProject(t3ProjectId);
    return { t3ProjectId };
  })();
  pendingProjectEnsures.set(pendingKey, ensurePromise);
  try {
    return await ensurePromise;
  } finally {
    pendingProjectEnsures.delete(pendingKey);
  }
}
async function createThread(projectId) {
  const activeProject = await waitForProject(projectId);
  const { baseUrl } = await ensureRuntime();
  const threadId = crypto.randomUUID();
  const modelSelection = parseModelSelection(activeProject.defaultModelSelectionJson);
  await sendWsRequest(baseUrl, {
    _tag: "orchestration.dispatchCommand",
    command: {
      type: "thread.create",
      commandId: crypto.randomUUID(),
      threadId,
      projectId,
      title: "New thread",
      modelSelection,
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  });
  return waitForThread(threadId);
}
async function ensurePanelThread(input) {
  const pending = pendingPanelThreadEnsures.get(input.panelId);
  if (pending) {
    return pending;
  }
  const ensurePromise = (async () => {
    const { baseUrl } = await ensureRuntime();
    const { t3ProjectId } = await ensureT3Project({
      spectrumProjectId: input.spectrumProjectId,
      projectPath: input.projectPath,
      projectName: input.projectName,
      existingT3ProjectId: input.existingT3ProjectId
    });
    let thread = input.existingT3ThreadId ? getThreadById(input.existingT3ThreadId) : null;
    if (!thread || thread.deletedAt || thread.projectId !== t3ProjectId) {
      thread = await createThread(t3ProjectId);
    }
    const metadata = getThreadMetadata(thread.threadId);
    return {
      baseUrl,
      t3ProjectId,
      t3ThreadId: thread.threadId,
      threadTitle: metadata.threadTitle,
      lastUserMessageAt: metadata.lastUserMessageAt,
      providerId: metadata.providerId
    };
  })();
  pendingPanelThreadEnsures.set(input.panelId, ensurePromise);
  try {
    return await ensurePromise;
  } finally {
    pendingPanelThreadEnsures.delete(input.panelId);
  }
}
async function getThreadInfo(t3ThreadId) {
  const activeRuntime = runtime;
  const metadata = getThreadMetadata(t3ThreadId);
  return {
    url: activeRuntime && activeRuntime.process.exitCode === null ? buildEmbeddedThreadUrl(activeRuntime.baseUrl, t3ThreadId) : null,
    threadTitle: metadata.threadTitle,
    lastUserMessageAt: metadata.lastUserMessageAt,
    providerId: metadata.providerId
  };
}
function watchThread(input) {
  const metadata = getThreadMetadata(input.t3ThreadId);
  watchedThreadsByPanelId.set(input.panelId, {
    panelId: input.panelId,
    t3ThreadId: input.t3ThreadId,
    priority: input.priority,
    lastPolledAt: 0,
    lastSnapshot: metadata
  });
  ensureWatchTimer();
  return true;
}
function unwatchThread(panelId) {
  const didDelete = watchedThreadsByPanelId.delete(panelId);
  stopWatchTimerIfIdle();
  return didDelete;
}
function getT3CodeLastUserMessageAt(t3ThreadId) {
  return getThreadMetadata(t3ThreadId).lastUserMessageAt;
}
function stopSharedRuntime() {
  const activeRuntime = runtime;
  runtime = null;
  pendingRuntimeStart = null;
  if (!activeRuntime) {
    return;
  }
  activeRuntime.process.kill();
}
function stopAllT3Code() {
  watchedThreadsByPanelId.clear();
  stopWatchTimerIfIdle();
  stopSharedRuntime();
}

// src/shared/project.types.ts
var PROJECT_COLOR_PALETTE = [
  { id: "molten-lava", name: "Molten Lava", hex: "#780000" },
  { id: "flag-red", name: "Flag Red", hex: "#C1121F" },
  { id: "persimmon", name: "Persimmon", hex: "#E85D04" },
  { id: "papaya-whip", name: "Papaya Whip", hex: "#FDF0D5" },
  { id: "gilded-honey", name: "Gilded Honey", hex: "#F4B942" },
  { id: "citron", name: "Citron", hex: "#A7C957" },
  { id: "moss-garden", name: "Moss Garden", hex: "#6A994E" },
  { id: "deep-forest", name: "Deep Forest", hex: "#386641" },
  { id: "sea-glass", name: "Sea Glass", hex: "#A8DADC" },
  { id: "lagoon", name: "Lagoon", hex: "#2A9D8F" },
  { id: "verdigris", name: "Verdigris", hex: "#3AAFA9" },
  { id: "deep-space-blue", name: "Deep Space Blue", hex: "#003049" },
  { id: "steel-blue", name: "Steel Blue", hex: "#669BBC" },
  { id: "storm-blue", name: "Storm Blue", hex: "#457B9D" },
  { id: "cobalt-glow", name: "Cobalt Glow", hex: "#3A86FF" },
  { id: "indigo-night", name: "Indigo Night", hex: "#3D348B" },
  { id: "violet-haze", name: "Violet Haze", hex: "#7B2CBF" },
  { id: "iris", name: "Iris", hex: "#8E7DBE" },
  { id: "orchid", name: "Orchid", hex: "#C77DFF" },
  { id: "neon-orchid", name: "Neon Orchid", hex: "#DA70D6" },
  { id: "rose-dust", name: "Rose Dust", hex: "#B56576" },
  { id: "wild-rose", name: "Wild Rose", hex: "#E56B6F" },
  { id: "coral-bloom", name: "Coral Bloom", hex: "#FF6B6B" },
  { id: "terracotta", name: "Terracotta", hex: "#CB997E" },
  { id: "sienna-clay", name: "Sienna Clay", hex: "#9C6644" },
  { id: "espresso", name: "Espresso", hex: "#6F4E37" },
  { id: "charcoal", name: "Charcoal", hex: "#2B2D42" },
  { id: "graphite", name: "Graphite", hex: "#4A4E69" },
  { id: "moonstone", name: "Moonstone", hex: "#8D99AE" },
  { id: "arctic-mint", name: "Arctic Mint", hex: "#B8F2E6" },
  { id: "mint-julep", name: "Mint Julep", hex: "#CDE77F" },
  { id: "sunlit-lemon", name: "Sunlit Lemon", hex: "#FFE66D" },
  { id: "apricot", name: "Apricot", hex: "#FFB4A2" },
  { id: "dusty-peach", name: "Dusty Peach", hex: "#E5989B" },
  { id: "merlot", name: "Merlot", hex: "#6D213C" },
  { id: "midnight-plum", name: "Midnight Plum", hex: "#5A189A" }
];
var LEGACY_PROJECT_COLOR_MAP = {
  slate: "graphite",
  red: "flag-red",
  orange: "persimmon",
  amber: "gilded-honey",
  emerald: "lagoon",
  teal: "verdigris",
  cyan: "sea-glass",
  sky: "steel-blue",
  blue: "cobalt-glow",
  indigo: "indigo-night",
  violet: "violet-haze",
  purple: "midnight-plum",
  fuchsia: "neon-orchid",
  pink: "wild-rose",
  rose: "rose-dust"
};
var DEFAULT_PROJECT_COLOR = PROJECT_COLOR_PALETTE[0].id;
function normalizeProjectColor(value) {
  if (!value) return DEFAULT_PROJECT_COLOR;
  const directMatch = PROJECT_COLOR_PALETTE.find((color) => color.id === value);
  if (directMatch) return directMatch.id;
  const legacyMatch = LEGACY_PROJECT_COLOR_MAP[value];
  return legacyMatch ?? DEFAULT_PROJECT_COLOR;
}
function getRandomProjectColor() {
  const index = Math.floor(Math.random() * PROJECT_COLOR_PALETTE.length);
  return PROJECT_COLOR_PALETTE[index].id;
}

// src/main/browser-cli/BrowserCliThreadBindingStore.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
function readBrowserCliThreadBindings() {
  const filePath = getBrowserCliThreadBindingsFilePath();
  try {
    const raw = (0, import_node_fs.readFileSync)(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeBrowserCliThreadBindings(records) {
  const filePath = getBrowserCliThreadBindingsFilePath();
  if (records.length === 0) {
    (0, import_node_fs.rmSync)(filePath, { force: true });
    return;
  }
  const directory = (0, import_node_path.dirname)(filePath);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  (0, import_node_fs.mkdirSync)(directory, { recursive: true });
  (0, import_node_fs.writeFileSync)(tempPath, JSON.stringify(records, null, 2));
  try {
    (0, import_node_fs.renameSync)(tempPath, filePath);
  } catch (error) {
    (0, import_node_fs.rmSync)(tempPath, { force: true });
    throw error;
  }
}
function upsertBrowserCliThreadBindingRecord(record) {
  const records = readBrowserCliThreadBindings().filter((entry) => entry.threadId !== record.threadId);
  records.push(record);
  writeBrowserCliThreadBindings(records);
}

// src/dev-server/index.ts
var dataDir = (0, import_path4.join)((0, import_os3.homedir)(), ".spectrum-dev");
if (!(0, import_fs3.existsSync)(dataDir)) (0, import_fs3.mkdirSync)(dataDir, { recursive: true });
var dbPath = (0, import_path4.join)(dataDir, "spectrum-dev.db");
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
var migrationsDir = (0, import_path4.join)(__dirname, "..", "main", "db", "migrations");
var srcMigrationsDir = (0, import_path4.join)(
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
    const sql = (0, import_fs3.readFileSync)((0, import_path4.join)(mDir, file), "utf-8");
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
    color: normalizeProjectColor(row.color),
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
    updatedAt: row.updated_at,
    lastPanelEditedAt: row.last_panel_edited_at ?? null
  };
}
function sanitizeLayoutStateForNewWorkspace(layoutState) {
  if (!layoutState || typeof layoutState !== "object") {
    return { panels: [], sizes: [] };
  }
  const panels = Array.isArray(layoutState.panels) ? layoutState.panels.map((panel) => ({
    ...panel,
    t3ProjectId: void 0,
    t3ThreadId: void 0
  })) : [];
  const sizes = Array.isArray(layoutState.sizes) ? layoutState.sizes : [];
  return {
    ...layoutState,
    panels,
    sizes
  };
}
function getNewerTimestamp(left, right) {
  const leftValue = left ? new Date(left).getTime() : Number.NaN;
  const rightValue = right ? new Date(right).getTime() : Number.NaN;
  if (Number.isNaN(leftValue)) {
    return Number.isNaN(rightValue) ? null : right ?? null;
  }
  if (Number.isNaN(rightValue) || leftValue >= rightValue) {
    return left ?? null;
  }
  return right ?? null;
}
function getLatestT3CodePanelActivityAt(layoutState, projectPath) {
  return layoutState.panels.reduce(
    (latestTimestamp, panel) => {
      if (panel.type !== "t3code") {
        return latestTimestamp;
      }
      return getNewerTimestamp(
        latestTimestamp,
        getT3CodeLastUserMessageAt(panel.id, projectPath)
      );
    },
    null
  );
}
function backfillWorkspaceLastPanelEditedAt(row) {
  const layoutState = JSON.parse(row.layout_state);
  const nextTimestamp = getNewerTimestamp(
    row.last_panel_edited_at ?? null,
    getLatestT3CodePanelActivityAt(layoutState, row.repo_path)
  );
  if (!nextTimestamp || nextTimestamp === row.last_panel_edited_at) {
    return row;
  }
  db.prepare("UPDATE workspaces SET last_panel_edited_at = ? WHERE id = ?").run(nextTimestamp, row.id);
  return {
    ...row,
    last_panel_edited_at: nextTimestamp
  };
}
function listWorkspacesForProject(args) {
  const projectId = typeof args === "string" ? args : args.projectId;
  const includeArchived = typeof args === "string" ? false : Boolean(args.includeArchived);
  return db.prepare(
    includeArchived ? `SELECT w.*, p.repo_path
           FROM workspaces w
           INNER JOIN projects p ON p.id = w.project_id
           WHERE w.project_id = ?
           ORDER BY w.archived ASC, w.created_at ASC` : `SELECT w.*, p.repo_path
           FROM workspaces w
           INNER JOIN projects p ON p.id = w.project_id
           WHERE w.project_id = ? AND w.archived = 0
           ORDER BY w.created_at ASC`
  ).all(projectId).map(backfillWorkspaceLastPanelEditedAt).map(rowToWorkspace);
}
function getProject(projectId) {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  return row ? rowToProject(row) : null;
}
function listWorkspaces(projectId, includeArchived = false) {
  return listWorkspacesForProject({ projectId, includeArchived });
}
var ptys = /* @__PURE__ */ new Map();
var wsClients = /* @__PURE__ */ new Set();
var browserPanels = /* @__PURE__ */ new Map();
var browserTokens = /* @__PURE__ */ new Map();
var focusedBrowserPanelIdByWorkspace = /* @__PURE__ */ new Map();
var userFocusedPanelIdByWorkspace = /* @__PURE__ */ new Map();
var browserApiServer = null;
var browserApiPort = null;
var TEMPORARY_BROWSER_PANEL_WIDTH = 350;
function getShell() {
  if (process.platform === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/zsh";
}
function getBrowserCliBinDir2() {
  return (0, import_path4.join)(process.cwd(), "resources", "browser-cli", "bin");
}
function prependBrowserCliToPath2(existingPath) {
  const binDir = getBrowserCliBinDir2();
  if (!existingPath) {
    return binDir;
  }
  return [binDir, ...existingPath.split(":").filter(Boolean)].join(":");
}
function getBrowserCommandPath2() {
  if (process.platform === "win32") {
    return (0, import_path4.join)(getBrowserCliBinDir2(), "browser.js");
  }
  return (0, import_path4.join)(getBrowserCliBinDir2(), "browser");
}
function getBrowserCliCommandPath2() {
  if (process.platform === "win32") {
    return (0, import_path4.join)(getBrowserCliBinDir2(), "browser-cli.js");
  }
  return (0, import_path4.join)(getBrowserCliBinDir2(), "browser-cli");
}
function getBrowserCliSessionFilePath2() {
  return (0, import_path4.join)(dataDir, "browser-cli", "sessions.json");
}
function registerBrowserToken(token, workspaceId, projectId) {
  browserTokens.set(token, { workspaceId, projectId });
}
function revokeBrowserToken(token) {
  browserTokens.delete(token);
}
function bindBrowserCliThread(input) {
  if (browserApiPort === null) {
    throw new Error("Browser API server is not started");
  }
  const existing = readBrowserCliThreadBindings().find((entry) => entry.threadId === input.threadId);
  const shouldReuseToken = existing?.workspaceId === input.workspaceId && existing.projectId === input.projectId;
  if (existing && !shouldReuseToken) {
    revokeBrowserToken(existing.browserApiToken);
  }
  const browserApiToken = shouldReuseToken ? existing.browserApiToken : (0, import_node_crypto2.randomUUID)().replace(/-/g, "");
  registerBrowserToken(browserApiToken, input.workspaceId, input.projectId);
  upsertBrowserCliThreadBindingRecord({
    threadId: input.threadId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    browserApiBaseUrl: `http://127.0.0.1:${browserApiPort}`,
    browserApiToken,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function pushBrowserEvent(channel, payload) {
  const message = JSON.stringify({
    type: channel,
    payload
  });
  for (const client of wsClients) {
    if (client.readyState === import_ws2.WebSocket.OPEN) {
      client.send(message);
    }
  }
}
function listBrowserPanelsForProject(projectId) {
  return Array.from(browserPanels.values()).filter((panel) => panel.projectId === projectId);
}
function getFocusedBrowserPanelMapForProject(projectId) {
  const nextMap = {};
  for (const panel of browserPanels.values()) {
    if (panel.projectId === projectId && !(panel.workspaceId in nextMap)) {
      nextMap[panel.workspaceId] = null;
    }
  }
  for (const [workspaceId, panelId] of focusedBrowserPanelIdByWorkspace.entries()) {
    const panel = browserPanels.get(panelId);
    if (!panel || panel.projectId !== projectId) {
      continue;
    }
    nextMap[workspaceId] = panelId;
  }
  return nextMap;
}
function getBrowserSnapshot(input) {
  if (!input.projectId) {
    return {
      panels: [],
      focusedBrowserPanelId: null,
      focusedByWorkspace: {},
      automationAttachedPanelIds: []
    };
  }
  const panels = listBrowserPanelsForProject(input.projectId);
  const focusedByWorkspace = getFocusedBrowserPanelMapForProject(input.projectId);
  const focusedBrowserPanelId = (input.activeWorkspaceId ? focusedByWorkspace[input.activeWorkspaceId] ?? null : null) ?? Object.values(focusedByWorkspace).find(
    (panelId) => typeof panelId === "string" && panelId.length > 0
  ) ?? null;
  return {
    panels,
    focusedBrowserPanelId,
    focusedByWorkspace,
    automationAttachedPanelIds: []
  };
}
function resolveReturnBrowserPanelId(panel) {
  const preferredIds = [panel.returnToPanelId, panel.parentPanelId];
  for (const preferredId of preferredIds) {
    if (!preferredId) {
      continue;
    }
    const preferredPanel = browserPanels.get(preferredId);
    if (preferredPanel && preferredPanel.workspaceId === panel.workspaceId) {
      return preferredId;
    }
  }
  return null;
}
function closeBrowserPanel(workspaceId, panelId) {
  const panel = browserPanels.get(panelId);
  if (!panel || panel.workspaceId !== workspaceId) {
    return null;
  }
  browserPanels.delete(panelId);
  if (focusedBrowserPanelIdByWorkspace.get(workspaceId) === panelId) {
    const nextFocusedPanelId = resolveReturnBrowserPanelId(panel);
    if (nextFocusedPanelId) {
      focusedBrowserPanelIdByWorkspace.set(workspaceId, nextFocusedPanelId);
    } else {
      focusedBrowserPanelIdByWorkspace.delete(workspaceId);
    }
    pushBrowserEvent(BROWSER_CHANNELS.FOCUS_CHANGED, {
      workspaceId,
      panelId: nextFocusedPanelId
    });
  }
  return panel;
}
function activateBrowserPanel(workspaceId, panelId) {
  const panel = browserPanels.get(panelId);
  if (!panel || panel.workspaceId !== workspaceId) {
    return null;
  }
  focusedBrowserPanelIdByWorkspace.set(workspaceId, panelId);
  pushBrowserEvent(BROWSER_CHANNELS.ACTIVATE, {
    workspaceId,
    panelId
  });
  pushBrowserEvent(BROWSER_CHANNELS.FOCUS_CHANGED, {
    workspaceId,
    panelId
  });
  return panel;
}
function readRequestBody(req) {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve2({});
        return;
      }
      try {
        resolve2(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
function startBrowserApiServer() {
  if (browserApiServer && browserApiPort !== null) {
    return Promise.resolve(browserApiPort);
  }
  browserApiServer = import_node_http.default.createServer(async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    let body;
    try {
      body = await readRequestBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid body" });
      return;
    }
    const token = typeof body.token === "string" ? body.token : "";
    const scope = browserTokens.get(token);
    if (!scope) {
      sendJson(res, 401, { error: "Invalid token" });
      return;
    }
    if (req.url === "/browser/open") {
      const panel = {
        panelId: nanoid(),
        workspaceId: scope.workspaceId,
        projectId: scope.projectId,
        url: typeof body.url === "string" ? body.url : "about:blank",
        panelTitle: "Browser",
        openedBy: body.openedBy === "agent" || body.openedBy === "popup" ? body.openedBy : "user",
        width: typeof body.width === "number" ? body.width : void 0,
        height: typeof body.height === "number" ? body.height : void 0
      };
      browserPanels.set(panel.panelId, panel);
      focusedBrowserPanelIdByWorkspace.set(scope.workspaceId, panel.panelId);
      pushBrowserEvent(BROWSER_CHANNELS.OPEN, panel);
      pushBrowserEvent(BROWSER_CHANNELS.FOCUS_CHANGED, {
        workspaceId: scope.workspaceId,
        panelId: panel.panelId
      });
      sendJson(res, 200, { panelId: panel.panelId });
      return;
    }
    if (req.url === "/browser/open-temporary") {
      const parentPanelId = typeof body.parentPanelId === "string" ? body.parentPanelId : "";
      const parentPanel = browserPanels.get(parentPanelId);
      if (!parentPanel || parentPanel.workspaceId !== scope.workspaceId) {
        sendJson(res, 404, { error: "Parent panel not found" });
        return;
      }
      const panel = {
        panelId: nanoid(),
        workspaceId: scope.workspaceId,
        projectId: scope.projectId,
        url: typeof body.url === "string" ? body.url : "about:blank",
        panelTitle: "Browser",
        isTemporary: true,
        parentPanelId,
        returnToPanelId: typeof body.returnToPanelId === "string" ? body.returnToPanelId : parentPanelId,
        openedBy: body.openedBy === "popup" ? "popup" : "agent",
        afterPanelId: parentPanelId,
        width: typeof body.width === "number" ? body.width : TEMPORARY_BROWSER_PANEL_WIDTH,
        height: typeof body.height === "number" ? body.height : void 0
      };
      browserPanels.set(panel.panelId, panel);
      focusedBrowserPanelIdByWorkspace.set(scope.workspaceId, panel.panelId);
      pushBrowserEvent(BROWSER_CHANNELS.OPEN, panel);
      pushBrowserEvent(BROWSER_CHANNELS.FOCUS_CHANGED, {
        workspaceId: scope.workspaceId,
        panelId: panel.panelId
      });
      sendJson(res, 200, { panelId: panel.panelId });
      return;
    }
    if (req.url === "/browser/navigate") {
      const panelId = typeof body.panelId === "string" ? body.panelId : "";
      const url = typeof body.url === "string" ? body.url : "";
      const panel = browserPanels.get(panelId);
      if (!panel || panel.workspaceId !== scope.workspaceId) {
        sendJson(res, 404, { error: "Panel not found" });
        return;
      }
      panel.url = url;
      pushBrowserEvent(BROWSER_CHANNELS.NAVIGATE, {
        panelId,
        workspaceId: scope.workspaceId,
        url
      });
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.url === "/browser/close") {
      const panelId = typeof body.panelId === "string" ? body.panelId : "";
      const panel = closeBrowserPanel(scope.workspaceId, panelId);
      if (!panel) {
        sendJson(res, 404, { error: "Panel not found" });
        return;
      }
      pushBrowserEvent(BROWSER_CHANNELS.CLOSE, {
        panelId,
        workspaceId: scope.workspaceId
      });
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.url === "/browser/resize") {
      const panelId = typeof body.panelId === "string" ? body.panelId : "";
      const width = typeof body.width === "number" ? body.width : Number.NaN;
      const height = typeof body.height === "number" ? body.height : Number.NaN;
      const panel = browserPanels.get(panelId);
      if (!panel || panel.workspaceId !== scope.workspaceId || Number.isNaN(width) || Number.isNaN(height)) {
        sendJson(res, 404, { error: "Panel not found" });
        return;
      }
      panel.width = width;
      panel.height = height;
      pushBrowserEvent(BROWSER_CHANNELS.RESIZE, {
        panelId,
        workspaceId: scope.workspaceId,
        width,
        height
      });
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.url === "/browser/list") {
      sendJson(res, 200, {
        focusedBrowserPanelId: focusedBrowserPanelIdByWorkspace.get(scope.workspaceId) ?? null,
        panels: Array.from(browserPanels.values()).filter(
          (panel) => panel.workspaceId === scope.workspaceId
        )
      });
      return;
    }
    if (req.url === "/browser/activate" || req.url === "/browser/set-agent-focus") {
      const panelId = typeof body.panelId === "string" ? body.panelId : "";
      const panel = activateBrowserPanel(scope.workspaceId, panelId);
      if (!panel) {
        sendJson(res, 404, { error: "Panel not found" });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.url === "/browser/cdp-endpoint") {
      sendJson(res, 200, { endpoint: null });
      return;
    }
    if (req.url === "/browser/session") {
      const project = getProject(scope.projectId);
      const workspace = listWorkspaces(scope.projectId, true).find(
        (entry) => entry.id === scope.workspaceId
      );
      sendJson(res, 200, {
        appInstanceId: `workspace:${scope.workspaceId}`,
        processId: process.pid,
        projectId: scope.projectId,
        workspaceId: scope.workspaceId,
        projectName: project?.name ?? null,
        workspaceName: workspace?.name ?? null,
        browserApiBaseUrl: `http://127.0.0.1:${browserApiPort}`,
        browserApiToken: token,
        cdpEndpoint: null,
        focusedBrowserPanelId: focusedBrowserPanelIdByWorkspace.get(scope.workspaceId) ?? null,
        userFocusedPanelId: userFocusedPanelIdByWorkspace.get(scope.workspaceId) ?? null,
        focused: true,
        lastHeartbeatAt: (/* @__PURE__ */ new Date()).toISOString(),
        capabilities: {
          activatePanel: true,
          createPanel: true,
          closePanel: true,
          listPanels: true
        }
      });
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  });
  return new Promise((resolve2, reject) => {
    browserApiServer.once("error", reject);
    browserApiServer.listen(0, "127.0.0.1", () => {
      browserApiServer.removeListener("error", reject);
      const address = browserApiServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to start browser API server"));
        return;
      }
      browserApiPort = address.port;
      resolve2(address.port);
    });
  });
}
async function stopBrowserApiServer() {
  if (!browserApiServer) {
    return;
  }
  await new Promise((resolve2) => browserApiServer?.close(() => resolve2()));
  browserApiServer = null;
  browserApiPort = null;
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
    const color = input.color || getRandomProjectColor();
    db.prepare(
      `INSERT INTO projects (id, name, repo_path, description, color, git_workspaces_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.repoPath,
      input.description || "",
      color,
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
    if (input.color !== void 0) {
      updates.push("color = ?");
      values.push(input.color);
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
    const defaultLayout = JSON.stringify(
      input.layoutState ? sanitizeLayoutStateForNewWorkspace(input.layoutState) : { panels: [], sizes: [] }
    );
    const parsedLayout = JSON.parse(defaultLayout);
    const lastPanelEditedAt = parsedLayout.panels.length > 0 ? now : null;
    db.prepare(
      `INSERT INTO workspaces (
        id,
        project_id,
        name,
        layout_state,
        created_at,
        updated_at,
        last_panel_edited_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.projectId, input.name, defaultLayout, now, now, lastPanelEditedAt);
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
    const result = db.prepare(
      "UPDATE workspaces SET layout_state = ?, updated_at = ?, last_panel_edited_at = ? WHERE id = ?"
    ).run(JSON.stringify(input.layoutState), now, now, input.id);
    if (result.changes === 0) {
      return null;
    }
    return rowToWorkspace(
      db.prepare("SELECT * FROM workspaces WHERE id = ?").get(input.id)
    );
  },
  "workspace:update-last-panel-edited-at": (input) => {
    const existing = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(input.id);
    if (!existing) {
      return null;
    }
    const nextTimestamp = new Date(input.timestamp);
    if (Number.isNaN(nextTimestamp.getTime())) {
      return rowToWorkspace(existing);
    }
    const currentTimestamp = existing.last_panel_edited_at ? new Date(existing.last_panel_edited_at) : null;
    if (currentTimestamp && !Number.isNaN(currentTimestamp.getTime()) && currentTimestamp.getTime() >= nextTimestamp.getTime()) {
      return rowToWorkspace(existing);
    }
    const result = db.prepare("UPDATE workspaces SET last_panel_edited_at = ? WHERE id = ?").run(input.timestamp, input.id);
    if (result.changes === 0) {
      return null;
    }
    return rowToWorkspace(
      db.prepare("SELECT * FROM workspaces WHERE id = ?").get(input.id)
    );
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
    const safeCwd = (0, import_fs3.existsSync)(args.cwd) ? args.cwd : (0, import_os3.homedir)();
    const env = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== void 0 && k !== "ELECTRON_RUN_AS_NODE") {
        env[k] = v;
      }
    }
    env.TERM = "xterm-256color";
    env.COLORTERM = "truecolor";
    env.PATH = prependBrowserCliToPath2(env.PATH);
    env.SPECTRUM_BROWSER = getBrowserCommandPath2();
    env.SPECTRUM_BROWSER_CLI = getBrowserCliCommandPath2();
    env.SPECTRUM_BROWSER_SESSION_FILE = getBrowserCliSessionFilePath2();
    const browserApiToken = nanoid(32);
    registerBrowserToken(browserApiToken, args.workspaceId, args.projectId);
    if (browserApiPort !== null) {
      env.SPECTRUM_API_PORT = String(browserApiPort);
      env.SPECTRUM_API_TOKEN = browserApiToken;
      env.SPECTRUM_WORKSPACE_ID = args.workspaceId;
      env.SPECTRUM_PROJECT_ID = args.projectId;
    }
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: safeCwd,
      env
    });
    ptyProcess.onData((data) => {
      if (ws.readyState === import_ws2.WebSocket.OPEN) {
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
      if (ws.readyState === import_ws2.WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "terminal:exit",
            id: args.id,
            exitCode
          })
        );
      }
      revokeBrowserToken(browserApiToken);
      ptys.delete(args.id);
    });
    ptys.set(args.id, {
      pty: ptyProcess,
      projectId: args.projectId,
      workspaceId: args.workspaceId,
      ws,
      browserApiToken
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
      revokeBrowserToken(instance.browserApiToken);
      ptys.delete(args.id);
    }
  },
  "t3code:start": async (args) => {
    const resolvedInstanceId = args.instanceId ?? args.workspaceId;
    if (!resolvedInstanceId) {
      throw new Error("Missing T3Code panel instance id");
    }
    return ensurePanelThread({
      panelId: resolvedInstanceId,
      spectrumProjectId: args.projectId ?? resolvedInstanceId,
      projectPath: args.projectPath,
      projectName: args.projectPath.split("/").filter(Boolean).at(-1) ?? "Project"
    }).then((binding) => {
      if (args.workspaceId) {
        bindBrowserCliThread({
          threadId: binding.t3ThreadId,
          workspaceId: args.workspaceId,
          projectId: args.projectId ?? resolvedInstanceId
        });
      }
      return binding;
    });
  },
  "t3code:stop": (payload) => {
    const resolvedInstanceId = typeof payload === "string" ? payload : payload.instanceId ?? payload.workspaceId;
    if (!resolvedInstanceId) {
      throw new Error("Missing T3Code panel instance id");
    }
    stopAllT3Code();
  },
  "t3code:get-thread-info": (args) => {
    const resolvedThreadId = args.t3ThreadId ?? args.instanceId ?? args.workspaceId;
    if (!resolvedThreadId) {
      throw new Error("Missing T3Code thread id");
    }
    return getThreadInfo(resolvedThreadId);
  },
  [T3CODE_CHANNELS.ENSURE_RUNTIME]: () => ensureRuntime(),
  [T3CODE_CHANNELS.ENSURE_PROJECT]: (args) => ensureT3Project({
    spectrumProjectId: args.spectrumProjectId,
    projectPath: args.projectPath,
    projectName: args.projectName,
    existingT3ProjectId: args.existingT3ProjectId
  }),
  [T3CODE_CHANNELS.ENSURE_PANEL_THREAD]: (args) => ensurePanelThread({
    panelId: args.panelId,
    spectrumProjectId: args.spectrumProjectId,
    projectPath: args.projectPath,
    projectName: args.projectName,
    existingT3ProjectId: args.existingT3ProjectId,
    existingT3ThreadId: args.existingT3ThreadId
  }).then((binding) => {
    bindBrowserCliThread({
      threadId: binding.t3ThreadId,
      workspaceId: args.workspaceId,
      projectId: args.spectrumProjectId
    });
    return binding;
  }),
  [T3CODE_CHANNELS.GET_THREAD_INFO]: (args) => getThreadInfo(args.t3ThreadId),
  [T3CODE_CHANNELS.WATCH_THREAD]: (args) => watchThread({
    panelId: args.panelId,
    t3ThreadId: args.t3ThreadId,
    priority: args.priority
  }),
  [T3CODE_CHANNELS.UNWATCH_THREAD]: (args) => unwatchThread(args.panelId),
  [BROWSER_CHANNELS.WEBVIEW_READY]: () => true,
  [BROWSER_CHANNELS.WEBVIEW_DESTROYED]: () => true,
  [BROWSER_CHANNELS.URL_CHANGED]: (payload) => {
    const panel = browserPanels.get(payload.panelId);
    if (!panel) {
      return false;
    }
    if (typeof payload.url === "string") {
      panel.url = payload.url;
    }
    if (typeof payload.panelTitle === "string" && payload.panelTitle.trim().length > 0) {
      panel.panelTitle = payload.panelTitle.trim();
    }
    return true;
  },
  [BROWSER_CHANNELS.SNAPSHOT]: (payload) => getBrowserSnapshot(payload),
  [BROWSER_CHANNELS.LIST]: (payload) => ({
    focusedBrowserPanelId: focusedBrowserPanelIdByWorkspace.get(payload.workspaceId) ?? null,
    panels: Array.from(browserPanels.values()).filter(
      (panel) => panel.workspaceId === payload.workspaceId
    )
  }),
  [BROWSER_CHANNELS.GET]: (payload) => browserPanels.get(payload.panelId) ?? null,
  [BROWSER_CHANNELS.SESSION]: (payload) => {
    const workspaceId = payload?.workspaceId ?? Array.from(focusedBrowserPanelIdByWorkspace.keys())[0] ?? null;
    if (!workspaceId) {
      return null;
    }
    const panel = Array.from(browserPanels.values()).find((entry) => entry.workspaceId === workspaceId);
    if (!panel) {
      return null;
    }
    const project = getProject(panel.projectId);
    const workspace = listWorkspaces(panel.projectId, true).find((entry) => entry.id === workspaceId);
    return {
      appInstanceId: `workspace:${workspaceId}`,
      processId: process.pid,
      projectId: panel.projectId,
      workspaceId,
      projectName: project?.name ?? null,
      workspaceName: workspace?.name ?? null,
      browserApiBaseUrl: browserApiPort ? `http://127.0.0.1:${browserApiPort}` : null,
      browserApiToken: null,
      cdpEndpoint: null,
      focusedBrowserPanelId: focusedBrowserPanelIdByWorkspace.get(workspaceId) ?? null,
      userFocusedPanelId: userFocusedPanelIdByWorkspace.get(workspaceId) ?? null,
      focused: true,
      lastHeartbeatAt: (/* @__PURE__ */ new Date()).toISOString(),
      capabilities: {
        activatePanel: true,
        createPanel: true,
        closePanel: true,
        listPanels: true
      }
    };
  },
  [BROWSER_CHANNELS.SESSION_SYNC]: (payload) => {
    if (payload.activeWorkspaceId) {
      if (payload.userFocusedPanelId) {
        userFocusedPanelIdByWorkspace.set(payload.activeWorkspaceId, payload.userFocusedPanelId);
      } else {
        userFocusedPanelIdByWorkspace.delete(payload.activeWorkspaceId);
      }
    }
    return true;
  },
  [BROWSER_CHANNELS.ACTIVATE]: (payload) => Boolean(activateBrowserPanel(payload.workspaceId, payload.panelId)),
  [BROWSER_CHANNELS.CLOSE]: (payload) => {
    const panel = closeBrowserPanel(payload.workspaceId, payload.panelId);
    if (!panel) {
      return false;
    }
    pushBrowserEvent(BROWSER_CHANNELS.CLOSE, {
      panelId: payload.panelId,
      workspaceId: payload.workspaceId
    });
    return true;
  },
  [BROWSER_CHANNELS.CAPTURE_PREVIEW]: () => ({
    dataUrl: null
  }),
  [BROWSER_CHANNELS.OPEN_TEMPORARY]: (payload) => {
    const panel = {
      panelId: nanoid(),
      workspaceId: payload.workspaceId,
      projectId: payload.projectId,
      url: payload.url,
      panelTitle: "Browser",
      isTemporary: true,
      parentPanelId: payload.parentPanelId,
      returnToPanelId: payload.returnToPanelId ?? payload.parentPanelId,
      openedBy: payload.openedBy ?? "popup",
      afterPanelId: payload.parentPanelId,
      width: payload.width ?? TEMPORARY_BROWSER_PANEL_WIDTH,
      height: payload.height
    };
    browserPanels.set(panel.panelId, panel);
    focusedBrowserPanelIdByWorkspace.set(payload.workspaceId, panel.panelId);
    pushBrowserEvent(BROWSER_CHANNELS.OPEN, panel);
    pushBrowserEvent(BROWSER_CHANNELS.FOCUS_CHANGED, {
      workspaceId: payload.workspaceId,
      panelId: panel.panelId
    });
    return panel;
  }
};
var PORT = 3001;
var wss = new import_ws2.WebSocketServer({ port: PORT });
void startBrowserApiServer().then((port) => {
  console.log(`     Browser API: http://127.0.0.1:${port}`);
}).catch((error) => {
  console.error("[dev-server] Failed to start browser API server:", error);
});
wss.on("connection", (ws) => {
  console.log("Client connected");
  wsClients.add(ws);
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
    wsClients.delete(ws);
    for (const [id, instance] of ptys) {
      if (instance.ws === ws) {
        instance.pty.kill();
        revokeBrowserToken(instance.browserApiToken);
        ptys.delete(id);
      }
    }
  });
});
console.log(`
  \u{1F41B} Spectrum dev server running on ws://localhost:${PORT}`);
console.log(`     Database: ${dbPath}`);
console.log(`     Open http://localhost:5173 in your browser
`);
process.on("SIGINT", () => {
  for (const [, instance] of ptys) {
    instance.pty.kill();
    revokeBrowserToken(instance.browserApiToken);
  }
  stopAllT3Code();
  void stopBrowserApiServer();
  db.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  for (const [, instance] of ptys) {
    instance.pty.kill();
    revokeBrowserToken(instance.browserApiToken);
  }
  stopAllT3Code();
  void stopBrowserApiServer();
  db.close();
  process.exit(0);
});
