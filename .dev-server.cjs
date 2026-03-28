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
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var import_path = require("path");
var import_fs = require("fs");
var import_os = require("os");

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
var dataDir = (0, import_path.join)((0, import_os.homedir)(), ".centipede-dev");
if (!(0, import_fs.existsSync)(dataDir)) (0, import_fs.mkdirSync)(dataDir, { recursive: true });
var dbPath = (0, import_path.join)(dataDir, "centipede-dev.db");
var db = new import_better_sqlite3.default(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
var migrationsDir = (0, import_path.join)(__dirname, "..", "main", "db", "migrations");
var srcMigrationsDir = (0, import_path.join)(
  process.cwd(),
  "src",
  "main",
  "db",
  "migrations"
);
var mDir = (0, import_fs.existsSync)(migrationsDir) ? migrationsDir : srcMigrationsDir;
if ((0, import_fs.existsSync)(mDir)) {
  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r) => r.name)
  );
  const files = (0, import_fs.readdirSync)(mDir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = (0, import_fs.readFileSync)((0, import_path.join)(mDir, file), "utf-8");
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
var ptys = /* @__PURE__ */ new Map();
function getShell() {
  if (process.platform === "win32") return "powershell.exe";
  return process.env.SHELL || "/bin/zsh";
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
  "workspace:list": (projectId) => {
    return db.prepare(
      "SELECT * FROM workspaces WHERE project_id = ? AND archived = 0 ORDER BY created_at ASC"
    ).all(projectId).map(rowToWorkspace);
  },
  "workspace:create": (input) => {
    const id = nanoid();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const defaultLayout = JSON.stringify({ panels: [], sizes: [] });
    db.prepare(
      `INSERT INTO workspaces (id, project_id, name, layout_state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.projectId, input.name, defaultLayout, now, now);
    return rowToWorkspace(
      db.prepare("SELECT * FROM workspaces WHERE id = ?").get(id)
    );
  },
  "workspace:archive": (id) => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const result = db.prepare(
      "UPDATE workspaces SET archived = 1, updated_at = ? WHERE id = ?"
    ).run(now, id);
    return result.changes > 0;
  },
  "workspace:delete": (id) => {
    const result = db.prepare("DELETE FROM workspaces WHERE id = ?").run(id);
    return result.changes > 0;
  },
  "dialog:select-directory": () => {
    return process.cwd();
  },
  "terminal:create": (args, ws) => {
    const shell = getShell();
    const safeCwd = (0, import_fs.existsSync)(args.cwd) ? args.cwd : (0, import_os.homedir)();
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
  }
};
var PORT = 3001;
var wss = new import_ws.WebSocketServer({ port: PORT });
wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.on("message", (raw) => {
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
        const result = handler(args, ws);
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
  db.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  for (const [, instance] of ptys) {
    instance.pty.kill();
  }
  db.close();
  process.exit(0);
});
