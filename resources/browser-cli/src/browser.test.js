import assert from "node:assert/strict";
import { test } from "node:test";

import { BrowserCli } from "./browser.js";

function createBrowser({ logger } = {}) {
  const api = {
    session: {
      workspaceId: "workspace-1",
      focusedBrowserPanelId: "focused-panel",
    },
    post: async () => ({}),
    getBrowser: async () => null,
    getCdpEndpoint: async () => null,
  };

  return new BrowserCli(api, { logger });
}

test("newPage registers ownership and is auto-closed in finishScriptExecution", async () => {
  const browser = createBrowser();
  const closedPanels = [];

  browser.beginScriptExecution();
  browser.openTemporaryPanel = async () => ({ panelId: "temp-1" });
  browser.waitForPanel = async () => ({ id: () => "temp-1" });
  browser.closePanel = async (panelId) => {
    closedPanels.push(panelId);
    browser.deregisterOwnedPanel(panelId);
  };

  await browser.newPage({ url: "https://example.com" });
  await browser.finishScriptExecution({ cleanupTimeoutMs: 50 });

  assert.deepEqual(closedPanels, ["temp-1"]);
});

test("newPage with persistent true is not auto-closed", async () => {
  const browser = createBrowser();
  const closedPanels = [];

  browser.beginScriptExecution();
  browser.openPanel = async () => ({ panelId: "persist-1" });
  browser.waitForPanel = async () => ({ id: () => "persist-1" });
  browser.closePanel = async (panelId) => {
    closedPanels.push(panelId);
    browser.deregisterOwnedPanel(panelId);
  };

  await browser.newPage({ persistent: true, url: "https://example.com" });
  await browser.finishScriptExecution({ cleanupTimeoutMs: 50 });

  assert.deepEqual(closedPanels, []);
});

test("getPage(existingPanel) is not registered for auto-cleanup", async () => {
  const browser = createBrowser();
  const closedPanels = [];

  browser.beginScriptExecution();
  browser.resolvePanelReference = async () => ({ panelId: "existing-1" });
  browser.waitForPanel = async () => ({ id: () => "existing-1" });
  browser.closePanel = async (panelId) => {
    closedPanels.push(panelId);
    browser.deregisterOwnedPanel(panelId);
  };

  await browser.getPage("existing");
  await browser.finishScriptExecution({ cleanupTimeoutMs: 50 });

  assert.deepEqual(closedPanels, []);
});

test("getPage(nonExistentName) delegates to newPage and is auto-closed", async () => {
  const browser = createBrowser();
  const closedPanels = [];

  browser.beginScriptExecution();
  browser.resolvePanelReference = async () => null;
  browser.openTemporaryPanel = async () => ({ panelId: "temp-from-name" });
  browser.waitForPanel = async () => ({ id: () => "temp-from-name" });
  browser.closePanel = async (panelId) => {
    closedPanels.push(panelId);
    browser.deregisterOwnedPanel(panelId);
  };

  await browser.getPage("search-results");
  await browser.finishScriptExecution({ cleanupTimeoutMs: 50 });

  assert.deepEqual(closedPanels, ["temp-from-name"]);
});

test("explicit page.close removes the panel from the cleanup set", async () => {
  const browser = createBrowser();
  const closedPanels = [];

  browser.beginScriptExecution();
  browser.openTemporaryPanel = async () => ({ panelId: "temp-close" });
  browser.waitForPanel = async () => ({
    id: () => "temp-close",
    close: async () => {
      await browser.closePanel("temp-close");
    }
  });
  browser.closePanel = async (panelId) => {
    closedPanels.push(panelId);
    browser.deregisterOwnedPanel(panelId);
  };

  const page = await browser.newPage({ url: "https://example.com" });
  await page.close();
  await browser.finishScriptExecution({ cleanupTimeoutMs: 50 });

  assert.deepEqual(closedPanels, ["temp-close"]);
});

test("finishScriptExecution times out without hanging", async () => {
  const logger = {
    messages: [],
    error(message) {
      this.messages.push(String(message));
    }
  };
  const browser = createBrowser({ logger });
  browser.beginScriptExecution();
  browser.registerOwnedPanel("slow-panel");
  browser.closePanel = async () => new Promise(() => {});

  const started = Date.now();
  await browser.finishScriptExecution({ cleanupTimeoutMs: 20 });
  const elapsed = Date.now() - started;

  assert.equal(elapsed < 250, true);
  assert.equal(logger.messages.some((message) => message.includes("cleanup timed out")), true);
});
