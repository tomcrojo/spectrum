import fs from "node:fs/promises";
import util from "node:util";
import { createSessionClient } from "./connect.js";
import { wrapError, BrowserCliError } from "./errors.js";
import { BrowserCli, readNamedFile, saveNamedFile } from "./browser.js";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const HELP_TEXT = `browser-cli controls browser panels inside a running Centipede workspace.

Important:
  - It does not launch or control external Chrome windows.
  - It only works when Centipede is already running and a workspace session is active.
  - \`--connect\` means "attach to the current Centipede workspace session".
  - \`browser.newPage(...)\` creates a new browser panel inside that workspace.

Usage:
  browser --help
  browser --json
  browser run script.js
  browser --connect <<'EOF'
  const pages = await browser.listPages();
  console.log(JSON.stringify(pages, null, 2));
  EOF

  browser --connect <<'EOF'
  const page = await browser.newPage({ name: 'docs', url: 'https://example.com' });
  await page.focus();
  console.log(page.id());
  EOF

Options:
  --help, -h           Show this help text
  --json               Print session and page summary as JSON
  --connect [target]   Attach to the active Centipede workspace session
  --workspace <id>     Choose a specific Centipede workspace
  --project <id>       Choose a specific Centipede project
  run <file>           Execute a script file instead of reading stdin

Script API:
  browser.listPages()
  browser.getPage(idOrAliasOrPredicate)
  browser.newPage({ name?, url?, width?, height? })
  browser.closePage(idOrAlias)
  browser.activePage()
  await saveScreenshot(buffer, name)
  await writeFile(name, data)
  await readFile(name)

Page handles are Playwright Page objects with three Centipede additions:
  page.id()            Return the Centipede panel id
  page.focus()         Activate the panel in Centipede
  page.snapshotForAI() Return a lightweight DOM snapshot

Common tasks:
  Create a browser panel:
    browser --connect <<'EOF'
    const page = await browser.newPage({ url: 'https://example.com' });
    await page.focus();
    EOF

  List mounted browser panels:
    browser --connect <<'EOF'
    console.log(await browser.listPages());
    EOF
`;

const FLAG_SPECS = new Map([
  ["--help", { takesValue: false }],
  ["-h", { takesValue: false }],
  ["--json", { takesValue: false }],
  ["--connect", { takesValue: false }],
  ["--workspace", { takesValue: true }],
  ["--project", { takesValue: true }],
]);

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
    "Valid browser-cli entrypoints are `browser --help`, `browser --json`, `browser run <file>`, or `browser --connect <<'EOF' ... EOF`.",
  ];

  if (["open", "new", "new-tab", "tab", "page", "newpage"].includes(normalized)) {
    hints.unshift(
      "If you want a new Centipede browser panel, run `browser --connect <<'EOF'` and call `await browser.newPage({ url: 'https://example.com' })` inside the script."
    );
  } else if (normalized === "connect") {
    hints.unshift("Use the `--connect` flag, not a `connect` subcommand: `browser --connect <<'EOF' ... EOF`.");
  } else if (normalized === "list") {
    hints.unshift("To inspect pages, run `browser --connect <<'EOF'` and call `await browser.listPages()`.");
  }

  return hints;
}

function parseArgs(argv) {
  const args = {
    connect: "auto",
    json: false,
    workspaceId: null,
    projectId: null,
    runFile: null,
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

    if (value === "--workspace") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--workspace` flag requires a workspace id.", {
          code: "MISSING_WORKSPACE",
          hints: ["Example: `browser --workspace <workspace-id> --json`"]
        });
      }

      args.workspaceId = nextValue;
      index += 1;
      continue;
    }

    if (value === "--project") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `--project` flag requires a project id.", {
          code: "MISSING_PROJECT",
          hints: ["Example: `browser --project <project-id> --json`"]
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

    if (value === "run") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("-")) {
        throw new BrowserCliError("The `run` command requires a script path.", {
          code: "MISSING_RUN_FILE",
          hints: [
            "Use `browser run script.js` to execute a file.",
            "Or pipe a script with `browser --connect <<'EOF' ... EOF`."
          ]
        });
      }

      args.runFile = nextValue;
      index += 1;
      continue;
    }

    if (value.startsWith("-")) {
      const suggestion = suggestFlag(value);
      throw new BrowserCliError(`Unknown option: ${value}`, {
        code: "UNKNOWN_OPTION",
        hints: suggestion
          ? [`Did you mean \`${suggestion}\`?`, "Run `browser --help` to see all supported options."]
          : ["Run `browser --help` to see all supported options."]
      });
    }

    throw new BrowserCliError(`Unknown command: ${value}`, {
      code: "UNKNOWN_COMMAND",
      hints: buildCommandHints(value)
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
  const runner = new AsyncFunction(
    ...Object.keys(globals),
    script
  );

  return runner(...Object.values(globals));
}

async function printSessionSummary(api, browser, json) {
  const pages = await browser.listPages();
  const payload = {
    session: {
      projectId: api.session.projectId,
      projectName: api.session.projectName,
      workspaceId: api.session.workspaceId,
      workspaceName: api.session.workspaceName,
      focusedBrowserPanelId: api.session.focusedBrowserPanelId,
      cdpEndpoint: await api.getCdpEndpoint().catch(() => null),
    },
    pages,
  };

  if (json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`Connected to ${payload.session.projectName} / ${payload.session.workspaceName}`);
  if (pages.length === 0) {
    console.log("No mounted browser panels found. Use browser.newPage({ url }) to create one.");
    return;
  }

  console.log(JSON.stringify(pages, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const api = await createSessionClient({
    connect: args.connect,
    workspaceId: args.workspaceId,
    projectId: args.projectId,
  });
  const browser = new BrowserCli(api);
  const script = await readScript(args.runFile);

  if (!script) {
    await printSessionSummary(api, browser, args.json);
    return;
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
}

main().catch((error) => {
  const wrapped = wrapError(error, "Browser CLI execution failed");
  if (wrapped instanceof BrowserCliError) {
    console.error(formatError(wrapped));
    process.exit(1);
  }

  console.error(`Error: ${String(error)}`);
  process.exit(1);
});
