import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import { BrowserCliError } from "./errors.js";
import { getSessionFilePath, normalizeConnectArg } from "./protocol.js";

const SESSION_STALE_MS = 15_000;

async function postJson(baseUrl, route, token, body = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      ...body,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new BrowserCliError(payload.error ?? `Request failed: ${route}`, {
      code: "API_ERROR",
    });
  }

  return payload;
}

async function readSessionsFile() {
  try {
    const raw = await fs.readFile(getSessionFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isFreshSession(entry) {
  const timestamp = Date.parse(entry.lastHeartbeatAt ?? "");
  return Number.isFinite(timestamp) && Date.now() - timestamp <= SESSION_STALE_MS;
}

function chooseSession(sessions, options) {
  const fresh = sessions.filter(isFreshSession);
  const filtered = fresh.filter((entry) => {
    if (options.projectId && entry.projectId !== options.projectId) {
      return false;
    }

    if (options.workspaceId && entry.workspaceId !== options.workspaceId) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    throw new BrowserCliError("No active Centipede workspace session found for browser-cli.", {
      code: "NO_SESSION",
      hints: [
        "browser-cli only controls browser panels inside a running Centipede workspace.",
        "Open Centipede, select a project/workspace, and keep that workspace active before running browser-cli.",
        "If you meant to open an external Chrome window, browser-cli cannot do that."
      ]
    });
  }

  if (filtered.length === 1) {
    return filtered[0];
  }

  const focused = filtered.filter((entry) => entry.focused);
  if (focused.length === 1) {
    return focused[0];
  }

  throw new BrowserCliError("Multiple active Centipede workspaces matched this request.", {
    code: "AMBIGUOUS_SESSION",
    hints: [
      "Retry with --workspace <id> to target one specific workspace.",
      "You can inspect available sessions with `browser --json` once a workspace is active."
    ]
  });
}

export async function resolveSession(options = {}) {
  if (process.env.CENTIPEDE_API_PORT && process.env.CENTIPEDE_API_TOKEN) {
    const browserApiBaseUrl = `http://127.0.0.1:${process.env.CENTIPEDE_API_PORT}`;
    const browserApiToken = process.env.CENTIPEDE_API_TOKEN;
    const projectId = process.env.CENTIPEDE_PROJECT_ID ?? options.projectId ?? null;
    const workspaceId = process.env.CENTIPEDE_WORKSPACE_ID ?? options.workspaceId ?? null;
    const session = await postJson(browserApiBaseUrl, "/browser/session", browserApiToken).catch(
      async () => ({
        ...(await postJson(browserApiBaseUrl, "/browser/cdp-endpoint", browserApiToken)),
        projectId,
        workspaceId,
        projectName: null,
        workspaceName: null,
        focusedBrowserPanelId: null,
      })
    );
    return {
      ...session,
      browserApiBaseUrl,
      browserApiToken,
      projectId: projectId ?? session.projectId,
      workspaceId: workspaceId ?? session.workspaceId,
    };
  }

  const sessions = await readSessionsFile();
  return chooseSession(sessions, options);
}

export async function createSessionClient(options = {}) {
  const session = await resolveSession(options);
  let browserPromise = null;
  let currentEndpoint = null;

  const api = {
    session,
    async post(route, body = {}) {
      return postJson(session.browserApiBaseUrl, route, session.browserApiToken, body);
    },
    async getCdpEndpoint() {
      const payload = await api.post("/browser/cdp-endpoint");
      return payload.endpoint ?? null;
    },
    async getBrowser() {
      const endpoint = normalizeConnectArg(options.connect) !== "auto"
        ? normalizeConnectArg(options.connect)
        : await api.getCdpEndpoint();

      if (!endpoint) {
        throw new BrowserCliError("No mounted Centipede browser panel is available for CDP attachment.", {
          code: "NO_CDP_ENDPOINT",
          hints: [
            "browser-cli can create and control browser panels inside Centipede, but it does not attach to external Chrome windows.",
            "Make sure the target workspace is open in Centipede and at least one browser panel is mounted.",
            "If you only need to open a panel, prefer `browser open <url>`.",
            "Use `browser.newPage(...)` only when you need a Playwright page handle after the panel is mounted."
          ]
        });
      }

      if (!browserPromise || currentEndpoint !== endpoint) {
        currentEndpoint = endpoint;
        browserPromise = chromium.connectOverCDP(endpoint).catch((error) => {
          browserPromise = null;
          throw error;
        });
      }

      return browserPromise;
    },
  };

  return api;
}
