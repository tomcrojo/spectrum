import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, test } from "node:test";

import { BrowserCliError } from "./errors.js";
import { resolveSession } from "./connect.js";

const ENV_KEYS = [
  "SPECTRUM_API_PORT",
  "SPECTRUM_API_TOKEN",
  "SPECTRUM_PROJECT_ID",
  "SPECTRUM_WORKSPACE_ID",
  "SPECTRUM_BROWSER_THREAD_ID",
  "SPECTRUM_BROWSER_SESSION_FILE",
  "SPECTRUM_BROWSER_THREAD_BINDINGS_FILE",
];

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const ORIGINAL_FETCH = globalThis.fetch;
const TEMP_DIRS = new Set();
const execFileAsync = promisify(execFile);

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const originalValue = ORIGINAL_ENV[key];
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
}

function makeTempFiles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-cli-connect-"));
  TEMP_DIRS.add(dir);
  const sessionFile = path.join(dir, "sessions.json");
  const bindingsFile = path.join(dir, "thread-bindings.json");
  process.env.SPECTRUM_BROWSER_SESSION_FILE = sessionFile;
  process.env.SPECTRUM_BROWSER_THREAD_BINDINGS_FILE = bindingsFile;
  return { dir, sessionFile, bindingsFile };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function mockFetch(handler) {
  globalThis.fetch = async (url, options) => handler(url, options);
}

function mockJsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

afterEach(() => {
  restoreEnv();
  globalThis.fetch = ORIGINAL_FETCH;
  for (const dir of TEMP_DIRS) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  TEMP_DIRS.clear();
});

test("resolveSession uses explicit thread bindings before session-file fallback", async () => {
  const { sessionFile, bindingsFile } = makeTempFiles();
  writeJson(sessionFile, [
    {
      projectId: "project-focused",
      workspaceId: "workspace-focused",
      focused: true,
      lastHeartbeatAt: new Date().toISOString(),
    },
  ]);
  writeJson(bindingsFile, [
    {
      threadId: "thread-1",
      projectId: "project-thread",
      workspaceId: "workspace-thread",
      browserApiBaseUrl: "http://127.0.0.1:4567",
      browserApiToken: "thread-token",
      updatedAt: new Date().toISOString(),
    },
  ]);

  mockFetch((url) => {
    assert.equal(url, "http://127.0.0.1:4567/browser/session");
    return Promise.resolve(
      mockJsonResponse(200, {
        projectId: "project-thread",
        workspaceId: "workspace-thread",
        projectName: "Project Thread",
        workspaceName: "Workspace Thread",
      }),
    );
  });

  const session = await resolveSession({ threadId: "thread-1" });
  assert.equal(session.projectId, "project-thread");
  assert.equal(session.workspaceId, "workspace-thread");
  assert.equal(session.browserApiToken, "thread-token");
});

test("resolveSession accepts SPECTRUM_BROWSER_THREAD_ID when --thread is absent", async () => {
  const { bindingsFile } = makeTempFiles();
  process.env.SPECTRUM_BROWSER_THREAD_ID = "thread-env";
  writeJson(bindingsFile, [
    {
      threadId: "thread-env",
      projectId: "project-env",
      workspaceId: "workspace-env",
      browserApiBaseUrl: "http://127.0.0.1:4568",
      browserApiToken: "env-token",
      updatedAt: new Date().toISOString(),
    },
  ]);

  mockFetch(() =>
    Promise.resolve(
      mockJsonResponse(200, {
        projectId: "project-env",
        workspaceId: "workspace-env",
      }),
    ),
  );

  const session = await resolveSession({});
  assert.equal(session.projectId, "project-env");
  assert.equal(session.workspaceId, "workspace-env");
  assert.equal(session.browserApiToken, "env-token");
});

test("resolveSession keeps direct SPECTRUM_API credentials as the highest precedence", async () => {
  const { bindingsFile } = makeTempFiles();
  process.env.SPECTRUM_API_PORT = "9001";
  process.env.SPECTRUM_API_TOKEN = "direct-token";
  writeJson(bindingsFile, [
    {
      threadId: "thread-ignored",
      projectId: "project-thread",
      workspaceId: "workspace-thread",
      browserApiBaseUrl: "http://127.0.0.1:9999",
      browserApiToken: "ignored-token",
      updatedAt: new Date().toISOString(),
    },
  ]);

  let fetchCalls = 0;
  mockFetch((url) => {
    fetchCalls += 1;
    assert.equal(url, "http://127.0.0.1:9001/browser/session");
    return Promise.resolve(
      mockJsonResponse(200, {
        projectId: "project-direct",
        workspaceId: "workspace-direct",
      }),
    );
  });

  const session = await resolveSession({ threadId: "thread-ignored" });
  assert.equal(fetchCalls, 1);
  assert.equal(session.projectId, "project-direct");
  assert.equal(session.workspaceId, "workspace-direct");
  assert.equal(session.browserApiToken, "direct-token");
});

test("resolveSession fails closed when thread and workspace selection disagree", async () => {
  const { bindingsFile } = makeTempFiles();
  writeJson(bindingsFile, [
    {
      threadId: "thread-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      browserApiBaseUrl: "http://127.0.0.1:4567",
      browserApiToken: "thread-token",
      updatedAt: new Date().toISOString(),
    },
  ]);

  await assert.rejects(
    () => resolveSession({ threadId: "thread-1", workspaceId: "workspace-2" }),
    (error) =>
      error instanceof BrowserCliError &&
      error.code === "THREAD_WORKSPACE_MISMATCH" &&
      error.message.includes("workspace-1"),
  );
});

test("resolveSession reports stale thread bindings on 401", async () => {
  const { bindingsFile } = makeTempFiles();
  writeJson(bindingsFile, [
    {
      threadId: "thread-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      browserApiBaseUrl: "http://127.0.0.1:4567",
      browserApiToken: "thread-token",
      updatedAt: new Date().toISOString(),
    },
  ]);

  mockFetch(() => Promise.resolve(mockJsonResponse(401, { error: "Invalid token" })));

  await assert.rejects(
    () => resolveSession({ threadId: "thread-1" }),
    (error) => error instanceof BrowserCliError && error.code === "STALE_THREAD_BINDING",
  );
});

test("resolveSession reports app-unavailable errors when the browser API is unreachable", async () => {
  const { bindingsFile } = makeTempFiles();
  writeJson(bindingsFile, [
    {
      threadId: "thread-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      browserApiBaseUrl: "http://127.0.0.1:4567",
      browserApiToken: "thread-token",
      updatedAt: new Date().toISOString(),
    },
  ]);

  mockFetch(() => Promise.reject(new Error("connect ECONNREFUSED")));

  await assert.rejects(
    () => resolveSession({ threadId: "thread-1" }),
    (error) => error instanceof BrowserCliError && error.code === "APP_UNAVAILABLE",
  );
});

test("resolveSession includes status and hints for unexpected thread-binding API responses", async () => {
  const { bindingsFile } = makeTempFiles();
  writeJson(bindingsFile, [
    {
      threadId: "thread-1",
      projectId: "project-1",
      workspaceId: "workspace-1",
      browserApiBaseUrl: "http://127.0.0.1:4567",
      browserApiToken: "thread-token",
      updatedAt: new Date().toISOString(),
    },
  ]);

  mockFetch(() => Promise.resolve(mockJsonResponse(409, { error: "Conflict" })));

  await assert.rejects(
    () => resolveSession({ threadId: "thread-1" }),
    (error) =>
      error instanceof BrowserCliError &&
      error.code === "THREAD_BINDING_REQUEST_FAILED" &&
      error.status === 409 &&
      Array.isArray(error.hints) &&
      error.hints.some((hint) => hint.includes("HTTP 409")),
  );
});

test("resolveSession still uses the session file for non-threaded manual invocations", async () => {
  const { sessionFile } = makeTempFiles();
  writeJson(sessionFile, [
    {
      projectId: "project-manual",
      workspaceId: "workspace-manual",
      browserApiBaseUrl: "http://127.0.0.1:4570",
      browserApiToken: "manual-token",
      focused: true,
      lastHeartbeatAt: new Date().toISOString(),
    },
  ]);

  const session = await resolveSession({});
  assert.equal(session.projectId, "project-manual");
  assert.equal(session.workspaceId, "workspace-manual");
  assert.equal(session.browserApiToken, "manual-token");
});

test("cli emits structured JSON errors when --json is requested", async () => {
  const { bindingsFile, sessionFile } = makeTempFiles();
  writeJson(bindingsFile, []);
  writeJson(sessionFile, []);

  await assert.rejects(
    () =>
      execFileAsync(process.execPath, ["resources/browser-cli/src/cli.js", "--json", "--thread", "missing", "list"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SPECTRUM_BROWSER_SESSION_FILE: sessionFile,
          SPECTRUM_BROWSER_THREAD_BINDINGS_FILE: bindingsFile,
        },
      }),
    (error) => {
      const stderr = error?.stderr?.trim();
      assert.ok(stderr);
      const payload = JSON.parse(stderr);
      assert.equal(payload.code, "MISSING_THREAD_BINDING");
      assert.equal(typeof payload.error, "string");
      assert.ok(Array.isArray(payload.hints));
      return true;
    },
  );
});
