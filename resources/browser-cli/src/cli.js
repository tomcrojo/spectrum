import fs from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { pathToFileURL } from "node:url";
import { createSessionClient } from "./connect.js";
import { wrapError, BrowserCliError } from "./errors.js";
import { BrowserCli, readNamedFile, saveNamedFile } from "./browser.js";
import { GUIDE_TEXT, HELP_TEXT } from "./guide.js";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const FLAG_SPECS = new Map([
  ["--help", { takesValue: false }],
  ["-h", { takesValue: false }],
  ["--json", { takesValue: false }],
  ["--connect", { takesValue: false }],
  ["--no-preflight", { takesValue: false }],
  ["--thread", { takesValue: true }],
  ["--workspace", { takesValue: true }],
  ["--project", { takesValue: true }],
]);

const COMMAND_SPECS = new Set([
  "help",
  "guide",
  "status",
  "list",
  "open",
  "search",
  "goto",
  "focus",
  "close",
  "run",
]);

const PREFLIGHT_RULES = [
  {
    pattern: /\/devtools\/(?:page|browser)\//,
    code: "FORBIDDEN_RAW_CDP_SOCKET",
    message: "Script appears to open a raw DevTools endpoint directly.",
    hints: [
      "Use `browser.getPage(...)` or `browser.newPage(...)` instead of raw /devtools/... sockets.",
      "Use `browser open <url>` or `browser search <query>` to create durable panels.",
      "Use `--no-preflight` only if you intentionally accept unsupported behavior.",
    ],
  },
  {
    pattern: /\bconnectOverCDP\b/,
    code: "FORBIDDEN_DIRECT_CDP_ATTACH",
    message: "Script appears to attach to CDP directly.",
    hints: [
      "Use Spectrum-native helpers such as `browser.getPage(...)` and `browser.newPage(...)`.",
      "Do not call Playwright CDP attach helpers inside browser-cli scripts.",
      "Use `--no-preflight` only if you intentionally accept unsupported behavior.",
    ],
  },
  {
    pattern: /\b(?:chromium|playwright\.chromium|pw\.chromium)\.connect(?:OverCDP)?\s*\(/,
    code: "FORBIDDEN_DIRECT_CDP_ATTACH",
    message: "Script appears to bypass Spectrum's panel lifecycle with a direct browser connect call.",
    hints: [
      "Use `browser.getPage(...)` or `browser.newPage(...)` to work with Spectrum browser panels.",
      "Use `browser.openPanel(...)` or CLI `browser open/search` for durable workspace state.",
      "Use `--no-preflight` only if you intentionally accept unsupported behavior.",
    ],
  },
  {
    pattern: /\bnew\s+WebSocket\s*\([^)]*\/devtools\/(?:page|browser)\//s,
    code: "FORBIDDEN_RAW_CDP_SOCKET",
    message: "Script appears to create a raw WebSocket to a DevTools endpoint.",
    hints: [
      "Use `browser.getPage(...)` or `browser.newPage(...)` for Playwright page access.",
      "Do not manually open /devtools/page/... or /devtools/browser/... sockets in browser-cli scripts.",
      "Use `--no-preflight` only if you intentionally accept unsupported behavior.",
    ],
  },
];

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function suggestFlag(value) {
  const candidates = Array.from(FLAG_SPECS.keys()).filter((candidate) => candidate.startsWith("-"));
  let best = null;

  for (const candidate of candidates) {
    const distance = levenshtein(value, candidate);
    if (distance <= 3 && (!best || distance < best.distance)) {
      best = { candidate, distance };
    }
  }

  return best?.candidate ?? null;
}

function buildCommandHints(value) {
  const normalized = String(value).toLowerCase();
  const hints = [
    "Valid browser-cli entrypoints include `browser help`, `browser guide`, `browser status`, `browser search <query>`, `browser open <url>`, `browser list`, `browser focus <panel>`, `browser close <panel>`, `browser run <file>`, and `browser --connect <<'EOF' ... EOF`.",
  ];

  if (["new", "new-tab", "tab", "page", "newpage"].includes(normalized)) {
    hints.unshift("If you want a new Spectrum browser panel, run `browser open <url>`.");
  } else if (normalized === "connect") {
    hints.unshift("Use the `--connect` flag, not a `connect` subcommand: `browser --connect <<'EOF' ... EOF`.");
  } else if (normalized === "open") {
    hints.unshift("Use `browser open <url>` to create a new Spectrum browser panel.");
  } else if (normalized === "search") {
    hints.unshift("Use `browser search <query>` to open search results in a new Spectrum browser panel.");
  }

  return hints;
}

function parseIntegerFlag(value, flagName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new BrowserCliError(`The \`${flagName}\` flag requires an integer value.`, {
      code: "INVALID_INTEGER_FLAG",
      hints: [`Example: \`${flagName} 1280\``],
    });
  }

  return parsed;
}

function parseOpenArgs(commandArgs) {
  const result = {
    url: null,
    name: null,
    focus: false,
    width: undefined,
    height: undefined,
  };

  for (let index = 0; index < commandArgs.length; index += 1) {
    const value = commandArgs[index];

    if (value === "--name") {
      const nextValue = commandArgs[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--name` flag requires a panel label.", {
          code: "MISSING_OPEN_NAME",
          hints: ["Example: `browser open <url> --name \"YouTube: folagor\"`"],
        });
      }
      result.name = nextValue;
      index += 1;
      continue;
    }

    if (value === "--focus") {
      result.focus = true;
      continue;
    }

    if (value === "--no-focus") {
      result.focus = false;
      continue;
    }

    if (value === "--width") {
      const nextValue = commandArgs[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--width` flag requires a numeric value.", {
          code: "MISSING_OPEN_WIDTH",
        });
      }
      result.width = parseIntegerFlag(nextValue, "--width");
      index += 1;
      continue;
    }

    if (value === "--height") {
      const nextValue = commandArgs[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--height` flag requires a numeric value.", {
          code: "MISSING_OPEN_HEIGHT",
        });
      }
      result.height = parseIntegerFlag(nextValue, "--height");
      index += 1;
      continue;
    }

    if (value.startsWith("-")) {
      throw new BrowserCliError(`Unknown option for \`open\`: ${value}`, {
        code: "UNKNOWN_OPEN_OPTION",
        hints: ["Supported `open` options are `--name`, `--focus`, `--no-focus`, `--width`, and `--height`."],
      });
    }

    if (result.url === null) {
      result.url = value;
      continue;
    }

    throw new BrowserCliError(`Unexpected argument for \`open\`: ${value}`, {
      code: "UNEXPECTED_OPEN_ARGUMENT",
      hints: ["Usage: `browser open <url> [--name <label>] [--focus] [--width <n>] [--height <n>]`"],
    });
  }

  if (result.url === null) {
    throw new BrowserCliError("The `open` command requires a URL.", {
      code: "MISSING_OPEN_URL",
      hints: ["Example: `browser open https://www.youtube.com/results?search_query=folagor --focus`"],
    });
  }

  return result;
}

function getSearchUrl(engine, query) {
  const encoded = encodeURIComponent(query);

  switch (engine) {
    case "google":
      return `https://www.google.com/search?q=${encoded}`;
    case "youtube":
      return `https://www.youtube.com/results?search_query=${encoded}`;
    case "duckduckgo":
      return `https://duckduckgo.com/?q=${encoded}`;
    default:
      throw new BrowserCliError(`Unsupported search engine: ${engine}`, {
        code: "UNSUPPORTED_SEARCH_ENGINE",
        hints: ["Supported engines are `google`, `youtube`, and `duckduckgo`."],
      });
  }
}

function getDefaultSearchPanelName(engine, query) {
  const label = engine.charAt(0).toUpperCase() + engine.slice(1);
  return `${label}: ${query}`;
}

function parseSearchArgs(commandArgs) {
  const result = {
    engine: "google",
    name: null,
    focus: false,
    width: undefined,
    height: undefined,
    queryParts: [],
  };

  for (let index = 0; index < commandArgs.length; index += 1) {
    const value = commandArgs[index];

    if (value === "--engine") {
      const nextValue = commandArgs[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--engine` flag requires a search engine.", {
          code: "MISSING_SEARCH_ENGINE",
          hints: ["Supported engines are `google`, `youtube`, and `duckduckgo`."],
        });
      }
      result.engine = nextValue;
      index += 1;
      continue;
    }

    if (value === "--name") {
      const nextValue = commandArgs[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--name` flag requires a panel label.", {
          code: "MISSING_SEARCH_NAME",
          hints: ["Example: `browser search \"folagor\" --engine youtube --name \"YouTube: folagor\"`"],
        });
      }
      result.name = nextValue;
      index += 1;
      continue;
    }

    if (value === "--focus") {
      result.focus = true;
      continue;
    }

    if (value === "--no-focus") {
      result.focus = false;
      continue;
    }

    if (value === "--width") {
      const nextValue = commandArgs[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--width` flag requires a numeric value.", {
          code: "MISSING_SEARCH_WIDTH",
        });
      }
      result.width = parseIntegerFlag(nextValue, "--width");
      index += 1;
      continue;
    }

    if (value === "--height") {
      const nextValue = commandArgs[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--height` flag requires a numeric value.", {
          code: "MISSING_SEARCH_HEIGHT",
        });
      }
      result.height = parseIntegerFlag(nextValue, "--height");
      index += 1;
      continue;
    }

    if (value.startsWith("-")) {
      throw new BrowserCliError(`Unknown option for \`search\`: ${value}`, {
        code: "UNKNOWN_SEARCH_OPTION",
        hints: ["Supported `search` options are `--engine`, `--name`, `--focus`, `--no-focus`, `--width`, and `--height`."],
      });
    }

    result.queryParts.push(value);
  }

  const query = result.queryParts.join(" ").trim();
  if (!query) {
    throw new BrowserCliError("The `search` command requires a query.", {
      code: "MISSING_SEARCH_QUERY",
      hints: [
        "Example: `browser search \"folagor\" --engine youtube --focus`",
        "If you want a raw URL instead, use `browser open <url>`.",
      ],
    });
  }

  return {
    url: getSearchUrl(result.engine, query),
    name: result.name ?? getDefaultSearchPanelName(result.engine, query),
    focus: result.focus,
    width: result.width,
    height: result.height,
  };
}

export function parseArgs(argv) {
  const args = {
    connect: "auto",
    json: false,
    noPreflight: false,
    workspaceId: null,
    projectId: null,
    threadId: null,
    command: null,
    commandArgs: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--help" || value === "-h") {
      args.help = true;
      continue;
    }

    if (value === "--json") {
      args.json = true;
      continue;
    }

    if (value === "--no-preflight") {
      args.noPreflight = true;
      continue;
    }

    if (args.command) {
      args.commandArgs.push(value);
      continue;
    }

    if (value === "--workspace") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--workspace` flag requires a workspace id.", {
          code: "MISSING_WORKSPACE",
          hints: ["Example: `browser --workspace <workspace-id> status --json`"],
        });
      }

      args.workspaceId = nextValue;
      index += 1;
      continue;
    }

    if (value === "--thread") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--thread` flag requires a thread id.", {
          code: "MISSING_THREAD",
          hints: ["Example: `browser --thread <thread-id> list --json`"],
        });
      }

      args.threadId = nextValue;
      index += 1;
      continue;
    }

    if (value === "--project") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--project` flag requires a project id.", {
          code: "MISSING_PROJECT",
          hints: ["Example: `browser --project <project-id> status --json`"],
        });
      }

      args.projectId = nextValue;
      index += 1;
      continue;
    }

    if (value === "--connect") {
      const nextValue = argv[index + 1];
      if (nextValue && !nextValue.startsWith("-")) {
        args.connect = nextValue;
        index += 1;
      } else {
        args.connect = "auto";
      }
      continue;
    }

    if (value.startsWith("-")) {
      const suggestion = suggestFlag(value);
      throw new BrowserCliError(`Unknown option: ${value}`, {
        code: "UNKNOWN_OPTION",
        hints: suggestion
          ? [`Did you mean \`${suggestion}\`?`, "Run `browser --help` to see all supported options."]
          : ["Run `browser --help` to see all supported options."],
      });
    }

    if (COMMAND_SPECS.has(value)) {
      args.command = value;
      continue;
    }

    throw new BrowserCliError(`Unknown command: ${value}`, {
      code: "UNKNOWN_COMMAND",
      hints: buildCommandHints(value),
    });
  }

  return args;
}

function formatError(error) {
  const lines = [`Error: ${error.message}`];

  if (Array.isArray(error.hints) && error.hints.length > 0) {
    lines.push("");
    lines.push("Hints:");
    for (const hint of error.hints) {
      lines.push(`- ${hint}`);
    }
  }

  return lines.join("\n");
}

function serializeError(error) {
  return {
    error: error.message,
    code: error.code,
    hints: Array.isArray(error.hints) ? error.hints : [],
    ...(Number.isInteger(error.status) ? { status: error.status } : {}),
  };
}

export async function readScript(runFile) {
  if (runFile) {
    return fs.readFile(runFile, "utf8");
  }

  if (process.stdin.isTTY) {
    return null;
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const script = Buffer.concat(chunks).toString("utf8");
  return script.trim().length > 0 ? script : null;
}

export function stripCommentsForPreflight(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

export function preflightScript(source, options = {}) {
  if (options.enabled === false) {
    return;
  }

  const sanitized = stripCommentsForPreflight(source);
  for (const rule of PREFLIGHT_RULES) {
    if (rule.pattern.test(sanitized)) {
      throw new BrowserCliError(rule.message, {
        code: rule.code,
        hints: rule.hints,
      });
    }
  }
}

export async function executeScript(source, globals) {
  const script = `"use strict";\n${source}`;
  const runner = new AsyncFunction(...Object.keys(globals), script);
  return runner(...Object.values(globals));
}

function printPayload(payload, json) {
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function printSessionSummary(browser, json) {
  const payload = await browser.getStatus();

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Connected to ${payload.session.projectName} / ${payload.session.workspaceName}`);
  console.log(`CDP endpoint: ${payload.session.cdpEndpoint ?? "not available"}`);

  if (payload.panels.length === 0) {
    console.log("No mounted browser panels found. Use `browser open <url>` to create one.");
    console.log("If you need a search page first, use `browser search <query>`.");
    return;
  }

  console.log(JSON.stringify(payload.panels, null, 2));
}

export function createScriptGlobals(browser) {
  const consoleLike = {
    log: (...values) => console.log(...values),
    info: (...values) => console.info(...values),
    warn: (...values) => console.warn(...values),
    error: (...values) => console.error(...values),
    dir: (value) => console.log(util.inspect(value, { colors: false, depth: 4 })),
  };

  return {
    browser,
    console: consoleLike,
    saveScreenshot: (buffer, name) => saveNamedFile(name, buffer),
    writeFile: saveNamedFile,
    readFile: readNamedFile,
    Buffer,
    setTimeout,
    clearTimeout,
  };
}

export async function runScriptWithLifecycle(browser, script, options = {}) {
  preflightScript(script, { enabled: options.preflight !== false });
  browser.beginScriptExecution();

  try {
    await executeScript(script, createScriptGlobals(browser));
  } finally {
    await browser.finishScriptExecution({ cleanupTimeoutMs: options.cleanupTimeoutMs });
  }
}

async function runCommand(browser, args) {
  switch (args.command) {
    case null:
    case "status":
      await printSessionSummary(browser, args.json);
      return;

    case "help":
      console.log(HELP_TEXT);
      return;

    case "guide":
      console.log(GUIDE_TEXT);
      return;

    case "list": {
      const panels = await browser.listPanels();
      printPayload(panels, args.json);
      return;
    }

    case "open": {
      const options = parseOpenArgs(args.commandArgs);
      const panel = await browser.openPanel(options);
      printPayload(panel, args.json);
      return;
    }

    case "search": {
      const options = parseSearchArgs(args.commandArgs);
      const panel = await browser.openPanel(options);
      printPayload(panel, args.json);
      return;
    }

    case "goto": {
      const [panelRef, url, ...rest] = args.commandArgs;
      if (!panelRef || !url || rest.length > 0) {
        throw new BrowserCliError("Usage: `browser goto <panel-id-or-alias> <url>`", {
          code: "INVALID_GOTO_USAGE",
        });
      }

      const panel = await browser.navigatePanel(panelRef, url);
      printPayload(panel, args.json);
      return;
    }

    case "focus": {
      const [panelRef, ...rest] = args.commandArgs;
      if (!panelRef || rest.length > 0) {
        throw new BrowserCliError("Usage: `browser focus <panel-id-or-alias>`", {
          code: "INVALID_FOCUS_USAGE",
        });
      }

      const panel = await browser.focusPanel(panelRef);
      printPayload(panel, args.json);
      return;
    }

    case "close": {
      const [panelRef, ...rest] = args.commandArgs;
      if (!panelRef || rest.length > 0) {
        throw new BrowserCliError("Usage: `browser close <panel-id-or-alias>`", {
          code: "INVALID_CLOSE_USAGE",
        });
      }

      await browser.closePanel(panelRef);
      printPayload({ ok: true, panel: panelRef }, args.json);
      return;
    }

    case "run": {
      const [runFile, ...rest] = args.commandArgs;
      if (!runFile || rest.length > 0) {
        throw new BrowserCliError("The `run` command requires exactly one script path.", {
          code: "MISSING_RUN_FILE",
          hints: [
            "Use `browser run script.js` to execute a file.",
            "Or pipe a script with `browser --connect <<'EOF' ... EOF`.",
          ],
        });
      }

      const script = await readScript(runFile);
      if (!script) {
        throw new BrowserCliError(`Script file is empty: ${runFile}`, {
          code: "EMPTY_RUN_FILE",
        });
      }

      await runScriptWithLifecycle(browser, script, {
        preflight: !args.noPreflight,
      });
      return;
    }

    default:
      throw new BrowserCliError(`Unsupported command: ${args.command}`, {
        code: "UNSUPPORTED_COMMAND",
      });
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (args.command === "help" || args.command === "guide") {
    console.log(args.command === "guide" ? GUIDE_TEXT : HELP_TEXT);
    return;
  }

  const api = await createSessionClient({
    connect: args.connect,
    threadId: args.threadId,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
  });
  const browser = new BrowserCli(api);

  if (args.command === null && !process.stdin.isTTY) {
    const script = await readScript(null);
    if (script) {
      await runScriptWithLifecycle(browser, script, {
        preflight: !args.noPreflight,
      });
      return;
    }
  }

  await runCommand(browser, args);
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryPoint) {
  const rawArgv = process.argv.slice(2);
  const jsonRequested = rawArgv.includes("--json");

  main(rawArgv).catch((error) => {
    const wrapped = wrapError(error, "Browser CLI execution failed");
    if (wrapped instanceof BrowserCliError) {
      if (jsonRequested) {
        console.error(JSON.stringify(serializeError(wrapped), null, 2));
      } else {
        console.error(formatError(wrapped));
      }
      process.exit(1);
    }

    if (jsonRequested) {
      console.error(
        JSON.stringify(
          {
            error: String(error),
            code: "INTERNAL_ERROR",
            hints: [],
          },
          null,
          2
        )
      );
    } else {
      console.error(`Error: ${String(error)}`);
    }
    process.exit(1);
  });
}
