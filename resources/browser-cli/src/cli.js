import fs from "node:fs/promises";
import util from "node:util";
import { createSessionClient } from "./connect.js";
import { wrapError, BrowserCliError } from "./errors.js";
import { BrowserCli, readNamedFile, saveNamedFile } from "./browser.js";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const HELP_TEXT = `browser-cli controls browser panels inside a running Spectrum workspace.

Important:
  - It does not launch or control external Chrome windows.
  - It only works when Spectrum is already running and a workspace session is active.
  - \`--connect\` means "attach to the current Spectrum workspace session".
  - In Spectrum-managed shells, prefer \`$SPECTRUM_BROWSER\` first if \`browser\` is not on PATH.
  - Inside \`browser --connect\` scripts, use \`browser.getPage(...)\` / \`browser.newPage(...)\`; do not open raw \`/devtools/page/...\` WebSocket connections yourself.
  - Close temporary panels you create when they are no longer needed.

For simple tasks, prefer the built-in panel commands:
  browser open <url> [--name <label>] [--focus]
  browser search <query> [--engine google|youtube|duckduckgo] [--name <label>] [--focus]
  browser list [--json]
  browser status [--json]
  browser goto <panel-id-or-alias> <url>
  browser focus <panel-id-or-alias>
  browser close <panel-id-or-alias>

Use \`browser run\` or \`browser --connect <<'EOF'\` only for advanced DOM automation.

Usage:
  browser help
  browser --help
  "$SPECTRUM_BROWSER" --help
  browser status --json
  browser search "folagor" --engine youtube --focus
  browser open "https://www.youtube.com/results?search_query=folagor" --name "YouTube: folagor" --focus
  browser goto "YouTube: folagor" "https://youtube.com"
  browser focus "YouTube: folagor"
  browser close "YouTube: folagor"
  browser run script.js
  browser --connect <<'EOF'
  const page = await browser.getPage("YouTube: folagor");
  console.log(await page.title());
  EOF

Options:
  --help, -h           Show this help text
  --json               Print structured JSON output
  --connect [target]   Attach to the active Spectrum workspace session
  --thread <id>        Target one T3Code thread's workspace (used by agent shims)
  --workspace <id>     Choose a specific Spectrum workspace
  --project <id>       Choose a specific Spectrum project

Commands:
  help                 Show this help text
  status               Show session status and mounted browser panels
  list                 List mounted browser panels
  open <url>           Open a new browser panel without requiring CDP attachment
  search <query>       Open a search results page in a new browser panel
  goto <panel> <url>   Navigate an existing browser panel
  focus <panel>        Focus an existing browser panel
  close <panel>        Close an existing browser panel
  run <file>           Execute a script file instead of reading stdin

Script API:
  browser.listPanels()
  browser.openPanel({ url, name?, focus?, width?, height? })
  browser.navigatePanel(idOrAlias, url)
  browser.focusPanel(idOrAlias)
  browser.closePanel(idOrAlias)
  browser.getStatus()
  browser.listPages()
  browser.getPage(idOrAliasOrPredicate)
  browser.newPage({ name?, url?, width?, height? })  // waits for Playwright attachment
  browser.activePage()
  await saveScreenshot(buffer, name)
  await writeFile(name, data)
  await readFile(name)
`;

const FLAG_SPECS = new Map([
  ["--help", { takesValue: false }],
  ["-h", { takesValue: false }],
  ["--json", { takesValue: false }],
  ["--connect", { takesValue: false }],
  ["--thread", { takesValue: true }],
  ["--workspace", { takesValue: true }],
  ["--project", { takesValue: true }],
]);

const COMMAND_SPECS = new Set(["help", "status", "list", "open", "search", "goto", "focus", "close", "run"]);

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
    "Valid browser-cli entrypoints include `browser help`, `browser status`, `browser search <query>`, `browser open <url>`, `browser list`, `browser focus <panel>`, `browser close <panel>`, `browser run <file>`, and `browser --connect <<'EOF' ... EOF`.",
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

function parseArgs(argv) {
  const args = {
    connect: "auto",
    json: false,
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

async function readScript(runFile) {
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

async function executeScript(source, globals) {
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
    return;
  }

  console.log(JSON.stringify(payload.panels, null, 2));
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

      const consoleLike = {
        log: (...values) => console.log(...values),
        info: (...values) => console.info(...values),
        warn: (...values) => console.warn(...values),
        error: (...values) => console.error(...values),
        dir: (value) => console.log(util.inspect(value, { colors: false, depth: 4 })),
      };

      await executeScript(script, {
        browser,
        console: consoleLike,
        saveScreenshot: (buffer, name) => saveNamedFile(name, buffer),
        writeFile: saveNamedFile,
        readFile: readNamedFile,
        Buffer,
        setTimeout,
        clearTimeout,
      });
      return;
    }

    default:
      throw new BrowserCliError(`Unsupported command: ${args.command}`, {
        code: "UNSUPPORTED_COMMAND",
      });
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP_TEXT);
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
      const consoleLike = {
        log: (...values) => console.log(...values),
        info: (...values) => console.info(...values),
        warn: (...values) => console.warn(...values),
        error: (...values) => console.error(...values),
        dir: (value) => console.log(util.inspect(value, { colors: false, depth: 4 })),
      };

      await executeScript(script, {
        browser,
        console: consoleLike,
        saveScreenshot: (buffer, name) => saveNamedFile(name, buffer),
        writeFile: saveNamedFile,
        readFile: readNamedFile,
        Buffer,
        setTimeout,
        clearTimeout,
      });
      return;
    }
  }

  await runCommand(browser, args);
}

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
