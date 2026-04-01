import fs from "node:fs/promises";
import path from "node:path";
import { createPageHandle, bindPanelToPage } from "./page.js";
import { BrowserCliError } from "./errors.js";
import { getBrowserCliTmpDir } from "./protocol.js";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readStateFile(stateFile) {
  try {
    const raw = await fs.readFile(stateFile, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStateFile(stateFile, value) {
  await ensureDir(path.dirname(stateFile));
  await fs.writeFile(stateFile, JSON.stringify(value, null, 2));
}

async function getTargetIdForPlaywrightPage(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const info = await cdp.send("Target.getTargetInfo");
    return info?.targetInfo?.targetId ?? null;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function buildTargetIdToPageMap(browser) {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const targetPairs = await Promise.all(
    pages.map(async (page) => [await getTargetIdForPlaywrightPage(page), page])
  );
  return new Map(targetPairs.filter(([targetId]) => Boolean(targetId)));
}

export class BrowserCli {
  constructor(api) {
    this.api = api;
    this.aliasStateFile = path.join(path.dirname(getBrowserCliTmpDir()), "state.json");
  }

  async loadAliasState() {
    const state = await readStateFile(this.aliasStateFile);
    return state[this.api.session.workspaceId] ?? {};
  }

  async saveAliasState(aliases) {
    const state = await readStateFile(this.aliasStateFile);
    state[this.api.session.workspaceId] = aliases;
    await writeStateFile(this.aliasStateFile, state);
  }

  async listPanels() {
    const panelPayload = await this.api.post("/browser/list");
    const aliases = await this.loadAliasState();
    const aliasByPanelId = new Map(
      Object.entries(aliases).map(([name, panelId]) => [panelId, name])
    );

    return (panelPayload.panels ?? []).map((panel) => ({
      id: panel.panelId,
      panelId: panel.panelId,
      targetId: panel.targetId,
      url: panel.url,
      title: panel.panelTitle,
      isTemporary: Boolean(panel.isTemporary),
      parentPanelId: panel.parentPanelId,
      returnToPanelId: panel.returnToPanelId,
      openedBy: panel.openedBy,
      name: aliasByPanelId.get(panel.panelId) ?? null,
      workspaceId: panel.workspaceId,
      workspaceName: panel.workspaceName,
      projectId: panel.projectId,
      projectName: panel.projectName,
      kind: panel.kind,
      isFocused: panel.isFocused,
      isVisible: panel.isVisible,
    }));
  }

  async listPages() {
    const [panels, browser, aliases] = await Promise.all([
      this.listPanels(),
      this.api.getBrowser().catch(() => null),
      this.loadAliasState(),
    ]);
    const aliasByPanelId = new Map(
      Object.entries(aliases).map(([name, panelId]) => [panelId, name])
    );

    let pagesByTargetId = new Map();

    if (browser) {
      pagesByTargetId = await buildTargetIdToPageMap(browser);
    }

    return Promise.all(
      panels.map(async (panel) => {
        const page = panel.targetId ? pagesByTargetId.get(panel.targetId) ?? null : null;
        return {
          id: panel.panelId,
          panelId: panel.panelId,
          targetId: panel.targetId,
          url: page ? page.url() : panel.url,
          title: page ? await page.title().catch(() => panel.title) : panel.title,
          isTemporary: panel.isTemporary,
          parentPanelId: panel.parentPanelId,
          returnToPanelId: panel.returnToPanelId,
          openedBy: panel.openedBy,
          name: aliasByPanelId.get(panel.panelId) ?? null,
          workspaceId: panel.workspaceId,
          workspaceName: panel.workspaceName,
          projectId: panel.projectId,
          projectName: panel.projectName,
          kind: panel.kind,
          isFocused: panel.isFocused,
          isVisible: panel.isVisible,
        };
      })
    );
  }

  async waitForPanel(panelId, timeoutMs = 15_000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const panels = await this.listPanels();
      const summary = panels.find((entry) => entry.panelId === panelId);
      if (summary?.targetId) {
        const browser = await this.api.getBrowser();
        const pagesByTargetId = await buildTargetIdToPageMap(browser);
        const page = pagesByTargetId.get(summary.targetId);
        if (page) {
          await bindPanelToPage(page, summary);
          return createPageHandle(page, summary, this.api);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new BrowserCliError(`Panel ${panelId} exists but no webview target is attached yet`, {
      code: "TARGET_NOT_READY",
    });
  }

  async resolvePanelReference(idOrName) {
    const panels = await this.listPanels();
    const aliases = await this.loadAliasState();
    const aliasPanelId = aliases[idOrName];
    return (
      panels.find((entry) => entry.panelId === idOrName) ??
      panels.find((entry) => entry.targetId === idOrName) ??
      (aliasPanelId ? panels.find((entry) => entry.panelId === aliasPanelId) : null) ??
      null
    );
  }

  async getPanel(idOrName) {
    if (typeof idOrName !== "string" || idOrName.trim().length === 0) {
      throw new BrowserCliError("browser.getPanel(...) requires a panel id or alias", {
        code: "INVALID_PANEL_REFERENCE",
      });
    }

    return this.resolvePanelReference(idOrName);
  }

  async openPanel(options = {}) {
    const payload = await this.api.post("/browser/open", {
      url: options.url ?? "about:blank",
      openedBy: options.openedBy ?? "user",
      width: options.width,
      height: options.height,
    });

    if (options.focus !== false) {
      await this.api.post("/browser/activate", { panelId: payload.panelId }).catch(() => {});
    }

    if (typeof options.name === "string" && options.name.trim()) {
      const aliases = await this.loadAliasState();
      aliases[options.name] = payload.panelId;
      await this.saveAliasState(aliases);
    }

    return {
      panelId: payload.panelId,
      ...(await this.resolvePanelReference(payload.panelId)),
    };
  }

  async openTemporaryPanel(options = {}) {
    const parentPanelId = options.parentPanelId ?? this.api.session.focusedBrowserPanelId;
    if (!parentPanelId) {
      return this.openPanel({
        ...options,
        openedBy: options.openedBy ?? "agent",
      });
    }

    const payload = await this.api.post("/browser/open-temporary", {
      parentPanelId,
      returnToPanelId: options.returnToPanelId ?? parentPanelId,
      url: options.url ?? "about:blank",
      openedBy: options.openedBy ?? "agent",
      width: options.width,
      height: options.height,
    });

    if (typeof options.name === "string" && options.name.trim()) {
      const aliases = await this.loadAliasState();
      aliases[options.name] = payload.panelId;
      await this.saveAliasState(aliases);
    }

    return {
      panelId: payload.panelId,
      ...(await this.resolvePanelReference(payload.panelId)),
    };
  }

  async focusPanel(idOrName) {
    const summary = await this.resolvePanelReference(idOrName);
    if (!summary) {
      throw new BrowserCliError(`Unknown panel: ${idOrName}`, {
        code: "PANEL_NOT_FOUND",
      });
    }

    await this.api.post("/browser/activate", { panelId: summary.panelId });
    return this.resolvePanelReference(summary.panelId);
  }

  async navigatePanel(idOrName, url) {
    const summary = await this.resolvePanelReference(idOrName);
    if (!summary) {
      throw new BrowserCliError(`Unknown panel: ${idOrName}`, {
        code: "PANEL_NOT_FOUND",
      });
    }

    await this.api.post("/browser/navigate", { panelId: summary.panelId, url });
    return this.resolvePanelReference(summary.panelId);
  }

  async getPage(idOrPredicate) {
    if (typeof idOrPredicate === "function") {
      const pages = await this.listPages();
      const match = pages.find((entry) => idOrPredicate(entry));
      return match ? this.waitForPanel(match.panelId) : null;
    }

    if (typeof idOrPredicate !== "string" || idOrPredicate.trim().length === 0) {
      throw new BrowserCliError("browser.getPage(...) requires a page id, alias, or predicate", {
        code: "INVALID_PAGE_REFERENCE",
      });
    }

    const existing = await this.resolvePanelReference(idOrPredicate);
    if (existing) {
      return this.waitForPanel(existing.panelId);
    }

    return this.newPage({ name: idOrPredicate });
  }

  async activePage() {
    const pages = await this.listPages();
    const summary = pages.find((entry) => entry.isFocused) ?? pages[0] ?? null;
    return summary ? this.waitForPanel(summary.panelId) : null;
  }

  async newPage(options = {}) {
    const panel =
      options.persistent === true
        ? await this.openPanel({ ...options, openedBy: options.openedBy ?? "agent" })
        : await this.openTemporaryPanel({ ...options, openedBy: options.openedBy ?? "agent" });

    try {
      return await this.waitForPanel(panel.panelId);
    } catch (error) {
      if (error instanceof BrowserCliError && error.code === "TARGET_NOT_READY") {
        throw new BrowserCliError(
          `Browser panel opened as ${panel.panelId}, but Playwright attachment is not ready yet.`,
          {
            code: "TARGET_NOT_READY",
            hints: [
              "The panel was created successfully inside Spectrum.",
              "For fire-and-forget panel creation, prefer `browser open <url>` or `browser.openPanel(...)`.",
              `Retry attachment with \`await browser.getPage("${panel.panelId}")\` once the panel is mounted.`,
            ],
          }
        );
      }

      throw error;
    }
  }

  async closePanel(idOrName) {
    const summary = await this.resolvePanelReference(idOrName);
    if (!summary) {
      throw new BrowserCliError(`Unknown panel: ${idOrName}`, {
        code: "PANEL_NOT_FOUND",
      });
    }

    await this.api.post("/browser/close", { panelId: summary.panelId });

    const aliases = await this.loadAliasState();
    const nextAliases = Object.fromEntries(
      Object.entries(aliases).filter(([, panelId]) => panelId !== summary.panelId)
    );
    await this.saveAliasState(nextAliases);
  }

  async closePage(idOrName) {
    return this.closePanel(idOrName);
  }

  async getStatus() {
    const [panels, cdpEndpoint] = await Promise.all([
      this.listPanels(),
      this.api.getCdpEndpoint().catch(() => null),
    ]);

    return {
      session: {
        projectId: this.api.session.projectId,
        projectName: this.api.session.projectName,
        workspaceId: this.api.session.workspaceId,
        workspaceName: this.api.session.workspaceName,
        focusedBrowserPanelId: this.api.session.focusedBrowserPanelId,
        userFocusedPanelId: this.api.session.userFocusedPanelId ?? null,
        cdpEndpoint,
      },
      panels,
    };
  }
}

export async function saveNamedFile(name, data) {
  const tmpDir = getBrowserCliTmpDir();
  await ensureDir(tmpDir);
  const targetPath = path.join(tmpDir, path.basename(name));
  await fs.writeFile(targetPath, data);
  return targetPath;
}

export async function readNamedFile(name) {
  const targetPath = path.join(getBrowserCliTmpDir(), path.basename(name));
  return fs.readFile(targetPath, "utf8");
}
