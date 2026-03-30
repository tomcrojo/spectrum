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

  async listPages() {
    const [panelPayload, browser] = await Promise.all([
      this.api.post("/browser/list"),
      this.api.getBrowser().catch(() => null),
    ]);

    const aliases = await this.loadAliasState();
    const aliasByPanelId = new Map(
      Object.entries(aliases).map(([name, panelId]) => [panelId, name])
    );

    let pagesByTargetId = new Map();

    if (browser) {
      const pages = browser.contexts().flatMap((context) => context.pages());
      const targetPairs = await Promise.all(
        pages.map(async (page) => [await getTargetIdForPlaywrightPage(page), page])
      );
      pagesByTargetId = new Map(targetPairs.filter(([targetId]) => Boolean(targetId)));
    }

    return Promise.all(
      (panelPayload.panels ?? []).map(async (panel) => {
        const page = panel.targetId ? pagesByTargetId.get(panel.targetId) ?? null : null;
        return {
          id: panel.panelId,
          panelId: panel.panelId,
          targetId: panel.targetId,
          url: page ? page.url() : panel.url,
          title: page ? await page.title().catch(() => panel.panelTitle) : panel.panelTitle,
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

  async waitForPanel(panelId, timeoutMs = 8000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const pages = await this.listPages();
      const summary = pages.find((entry) => entry.panelId === panelId);
      if (summary?.targetId) {
        const browser = await this.api.getBrowser();
        for (const page of browser.contexts().flatMap((context) => context.pages())) {
          const targetId = await getTargetIdForPlaywrightPage(page);
          if (targetId === summary.targetId) {
            await bindPanelToPage(page, summary);
            return createPageHandle(page, summary, this.api);
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new BrowserCliError(`Panel ${panelId} exists but no webview target is attached yet`, {
      code: "TARGET_NOT_READY",
    });
  }

  async resolvePanelReference(idOrName) {
    const pages = await this.listPages();
    const aliases = await this.loadAliasState();
    const aliasPanelId = aliases[idOrName];
    return (
      pages.find((entry) => entry.panelId === idOrName) ??
      pages.find((entry) => entry.targetId === idOrName) ??
      (aliasPanelId ? pages.find((entry) => entry.panelId === aliasPanelId) : null) ??
      null
    );
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
    const payload = await this.api.post("/browser/open", {
      url: options.url ?? "about:blank",
      width: options.width,
      height: options.height,
    });

    await this.api.post("/browser/activate", { panelId: payload.panelId }).catch(() => {});

    if (typeof options.name === "string" && options.name.trim()) {
      const aliases = await this.loadAliasState();
      aliases[options.name] = payload.panelId;
      await this.saveAliasState(aliases);
    }

    const page = await this.waitForPanel(payload.panelId);
    if (options.url && options.url !== "about:blank") {
      await page.goto(options.url);
    }
    return page;
  }

  async closePage(idOrName) {
    const summary = await this.resolvePanelReference(idOrName);
    if (!summary) {
      throw new BrowserCliError(`Unknown page: ${idOrName}`, {
        code: "PAGE_NOT_FOUND",
      });
    }

    await this.api.post("/browser/close", { panelId: summary.panelId });

    const aliases = await this.loadAliasState();
    const nextAliases = Object.fromEntries(
      Object.entries(aliases).filter(([, panelId]) => panelId !== summary.panelId)
    );
    await this.saveAliasState(nextAliases);
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
