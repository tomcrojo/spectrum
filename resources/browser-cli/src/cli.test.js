import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

import {
  parseArgs,
  preflightScript,
  runScriptWithLifecycle,
  stripCommentsForPreflight,
} from "./cli.js";

const execFileAsync = promisify(execFile);

test("parseArgs recognizes guide and no-preflight", () => {
  const args = parseArgs(["--no-preflight", "guide"]);
  assert.equal(args.noPreflight, true);
  assert.equal(args.command, "guide");
});

test("stripCommentsForPreflight removes normal comment-only lines", () => {
  const stripped = stripCommentsForPreflight(`// /devtools/page/123\nconst ok = true;`);
  assert.equal(stripped.includes("/devtools/page/123"), false);
});

test("preflightScript rejects raw DevTools sockets", () => {
  assert.throws(
    () => preflightScript(`const ws = new WebSocket("ws://127.0.0.1:9222/devtools/page/123");`),
    (error) => error.code === "FORBIDDEN_RAW_CDP_SOCKET"
  );
});

test("preflightScript rejects direct CDP attach helpers", () => {
  assert.throws(
    () => preflightScript(`await chromium.connectOverCDP("http://127.0.0.1:9222");`),
    (error) => error.code === "FORBIDDEN_DIRECT_CDP_ATTACH"
  );
});

test("preflightScript ignores comment-only references in normal cases", () => {
  assert.doesNotThrow(() => preflightScript(`// connectOverCDP\nconst value = 1;`));
});

test("runScriptWithLifecycle honors the preflight escape hatch", async () => {
  const browser = {
    beginScriptExecutionCalled: 0,
    finishScriptExecutionCalled: 0,
    beginScriptExecution() {
      this.beginScriptExecutionCalled += 1;
    },
    async finishScriptExecution() {
      this.finishScriptExecutionCalled += 1;
    }
  };

  await runScriptWithLifecycle(
    browser,
    `const endpoint = "ws://127.0.0.1:9222/devtools/page/123"; void endpoint;`,
    { preflight: false }
  );

  assert.equal(browser.beginScriptExecutionCalled, 1);
  assert.equal(browser.finishScriptExecutionCalled, 1);
});

test("browser --help stays concise and points to browser guide", async () => {
  const result = await execFileAsync(process.execPath, ["resources/browser-cli/src/cli.js", "--help"], {
    cwd: process.cwd(),
  });

  assert.equal(result.stdout.includes("browser guide"), true);
  assert.equal(result.stdout.includes("full AI usage guide"), true);
});

test("browser guide prints the long-form guide to stdout", async () => {
  const result = await execFileAsync(process.execPath, ["resources/browser-cli/src/cli.js", "guide"], {
    cwd: process.cwd(),
  });

  assert.equal(result.stdout.includes("Spectrum mental model"), true);
  assert.equal(result.stdout.includes("Cleanup model"), true);
  assert.equal(result.stdout.includes("browser.newPage"), true);
  assert.equal(result.stdout.includes("Forbidden patterns"), true);
});
