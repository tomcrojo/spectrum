import { YellowError } from "./errors.js";

async function getTargetIdForPage(page) {
  const cdp = await page.context().newCDPSession(page);

  try {
    const info = await cdp.send("Target.getTargetInfo");
    return info?.targetInfo?.targetId ?? null;
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function snapshotDom(page, options = {}) {
  const depth = typeof options.depth === "number" ? options.depth : 5;

  return page.evaluate((maxDepth) => {
    function textFor(node) {
      return node.textContent?.replace(/\s+/g, " ").trim() ?? "";
    }

    function walk(node, currentDepth) {
      if (!node || currentDepth > maxDepth) {
        return [];
      }

      const name = node.tagName?.toLowerCase?.() ?? "#text";
      const labelParts = [name];
      if (node.id) labelParts.push(`#${node.id}`);
      if (node.getAttribute) {
        const role = node.getAttribute("role");
        if (role) labelParts.push(`[role=${role}]`);
        const testId = node.getAttribute("data-testid");
        if (testId) labelParts.push(`[data-testid=${testId}]`);
        const nameAttr = node.getAttribute("name");
        if (nameAttr) labelParts.push(`[name=${nameAttr}]`);
      }

      const lines = [];
      if (name !== "#text") {
        const text = textFor(node);
        lines.push(`${"  ".repeat(currentDepth)}${labelParts.join("")}${text ? ` :: ${text}` : ""}`);
      }

      for (const child of node.children ?? []) {
        lines.push(...walk(child, currentDepth + 1));
      }

      return lines;
    }

    return {
      full: walk(document.body, 0).join("\n"),
    };
  }, depth);
}

export async function bindPanelToPage(page, pageSummary) {
  const targetId = await getTargetIdForPage(page);
  if (!targetId || (pageSummary.targetId && targetId !== pageSummary.targetId)) {
    throw new YellowError(`Panel ${pageSummary.panelId} exists but no webview target is attached yet`, {
      code: "TARGET_NOT_READY",
    });
  }

  return page;
}

export function createPageHandle(page, pageSummary, api) {
  return new Proxy(page, {
    get(target, prop, receiver) {
      if (prop === "id") {
        return () => pageSummary.panelId;
      }

      if (prop === "focus") {
        return async () => {
          await api.post("/browser/activate", { panelId: pageSummary.panelId });
        };
      }

      if (prop === "snapshotForAI") {
        return async (options = {}) => snapshotDom(target, options);
      }

      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(target);
      }

      return value;
    },
  });
}
