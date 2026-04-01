import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import { BrowserCliError } from "./errors.js";
import { getSessionFilePath, getThreadBindingsFilePath, normalizeConnectArg } from "./protocol.js";

const SESSION_STALE_MS = 15_000;

async function requestJson(baseUrl, route, token, body = {}) {
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
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function postJson(baseUrl, route, token, body = {}) {
  const { ok, payload } = await requestJson(baseUrl, route, token, body);
  if (!ok) {
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

async function readThreadBindingsFile() {
  try {
    const raw = await fs.readFile(getThreadBindingsFilePath(), "utf8");
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
    throw new BrowserCliError("No active Spectrum workspace session found for browser-cli.", {
      code: "NO_SESSION",
      hints: [
        "browser-cli only controls browser panels inside a running Spectrum workspace.",
        "If this command came from an agent session, the workspace binding was not established and the provider session must be re-established before retrying.",
        "If this command came from a manual shell, open Spectrum and keep the target workspace active before retrying."
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

  throw new BrowserCliError("Multiple active Spectrum workspaces matched this request.", {
    code: "AMBIGUOUS_SESSION",
    hints: [
      "Retry with --workspace <id> to target one specific workspace.",
      "You can inspect available sessions with `browser --json` once a workspace is active."
    ]
  });
}

function assertThreadBindingMatches(binding, options) {
  if (options.projectId && binding.projectId !== options.projectId) {
    throw new BrowserCliError(
      `Thread \`${binding.threadId}\` is bound to project \`${binding.projectId}\`, not \`${options.projectId}\`.`,
      {
        code: "THREAD_PROJECT_MISMATCH",
        hints: [
          "Retry without `--project`, or target the project bound to this thread.",
        ],
      }
    );
  }

  if (options.workspaceId && binding.workspaceId !== options.workspaceId) {
    throw new BrowserCliError(
      `Thread \`${binding.threadId}\` is bound to workspace \`${binding.workspaceId}\`, not \`${options.workspaceId}\`.`,
      {
        code: "THREAD_WORKSPACE_MISMATCH",
        hints: [
          "Retry without `--workspace`, or target the workspace bound to this thread.",
        ],
      }
    );
  }
}

async function resolveThreadBindingSession(binding) {
  let response;

  try {
    response = await requestJson(
      binding.browserApiBaseUrl,
      "/browser/session",
      binding.browserApiToken
    );
  } catch (error) {
    throw new BrowserCliError("Spectrum's browser API is not reachable.", {
      code: "APP_UNAVAILABLE",
      hints: [
        "Spectrum's browser API is unavailable for this session.",
        "If Spectrum was restarted, this browser command cannot succeed until the session is re-established.",
      ],
    });
  }

  if (response.ok) {
    return {
      ...response.payload,
      browserApiBaseUrl: binding.browserApiBaseUrl,
      browserApiToken: binding.browserApiToken,
      projectId: response.payload.projectId ?? binding.projectId,
      workspaceId: response.payload.workspaceId ?? binding.workspaceId,
    };
  }

  if (response.status === 401 || response.status === 403) {
    throw new BrowserCliError(
      `Thread \`${binding.threadId}\` has a stale Spectrum browser binding.`,
      {
        code: "STALE_THREAD_BINDING",
        hints: [
          "The browser binding for this session has expired because the token was revoked or Spectrum restarted.",
          "This command cannot succeed until a new session binding is established.",
        ],
      }
    );
  }

  if (response.status >= 500) {
    throw new BrowserCliError("Spectrum's browser API is temporarily unavailable.", {
      code: "APP_UNAVAILABLE",
      hints: [
        "Verify Spectrum is still running and retry once the app is healthy again.",
      ],
    });
  }

  throw new BrowserCliError(
    response.payload?.error ??
      `Spectrum rejected the thread-bound browser request (HTTP ${response.status}).`,
    {
      code: "THREAD_BINDING_REQUEST_FAILED",
      status: response.status,
      hints: [
        `The browser API returned HTTP ${response.status} for this thread-bound request.`,
        "This may indicate a CLI and Spectrum version mismatch or an unsupported request shape.",
      ],
    }
  );
}

export async function resolveSession(options = {}) {
  if (process.env.SPECTRUM_API_PORT && process.env.SPECTRUM_API_TOKEN) {
    const browserApiBaseUrl = `http://127.0.0.1:${process.env.SPECTRUM_API_PORT}`;
    const browserApiToken = process.env.SPECTRUM_API_TOKEN;
    const projectId = process.env.SPECTRUM_PROJECT_ID ?? options.projectId ?? null;
    const workspaceId = process.env.SPECTRUM_WORKSPACE_ID ?? options.workspaceId ?? null;
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

  const threadId = options.threadId ?? process.env.SPECTRUM_BROWSER_THREAD_ID ?? null;
  if (threadId) {
    const bindings = await readThreadBindingsFile();
    const binding = bindings.find((entry) => entry.threadId === threadId);

    if (!binding) {
      throw new BrowserCliError(
        `Thread \`${threadId}\` is not bound to a Spectrum workspace.`,
        {
          code: "MISSING_THREAD_BINDING",
          hints: [
            "The browser workspace binding for this session is not registered.",
            "If Spectrum was restarted, this session must be re-established before browser commands will work.",
            "Agent-owned browser commands do not fall back to the active workspace.",
          ],
        }
      );
    }

    assertThreadBindingMatches(binding, options);
    return resolveThreadBindingSession(binding);
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
        throw new BrowserCliError("No mounted Spectrum browser panel is available for CDP attachment.", {
          code: "NO_CDP_ENDPOINT",
          hints: [
            "browser-cli can create and control browser panels inside Spectrum, but it does not attach to external Chrome windows.",
            "Make sure the target workspace is open in Spectrum and at least one browser panel is mounted.",
            "Spectrum may mount an agent-focused browser panel in the background without changing the user's visible focus.",
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
