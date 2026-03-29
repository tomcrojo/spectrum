import fs from "node:fs/promises";
import util from "node:util";
import { createSessionClient } from "./connect.js";
import { wrapError, YellowError } from "./errors.js";
import { YellowBrowser, readNamedFile, saveNamedFile } from "./browser.js";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const HELP_TEXT = `Browser CLI is Centipede's browser automation tool.

Scripts run with a preconnected \`browser\` global and top-level await support.
Pages map directly to mounted Centipede browser panels in the active workspace.

Usage:
  browser --help
  browser --connect <<'EOF'
  const pages = await browser.listPages();
  console.log(JSON.stringify(pages, null, 2));
  EOF

  browser run script.js

Script API:
  browser.listPages()
  browser.getPage(idOrAliasOrPredicate)
  browser.newPage({ name?, url?, width?, height? })
  browser.closePage(idOrAlias)
  browser.activePage()
  await saveScreenshot(buffer, name)
  await writeFile(name, data)
  await readFile(name)

Page handles are Playwright Page objects with two additions:
  page.id()       Return the Centipede panel id
  page.focus()    Activate the panel in Centipede
  page.snapshotForAI()  Return a lightweight DOM snapshot
`;

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
      args.workspaceId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (value === "--project") {
      args.projectId = argv[index + 1] ?? null;
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
      args.runFile = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
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
  const browser = new YellowBrowser(api);
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
  if (wrapped instanceof YellowError) {
    console.error(`Error: ${wrapped.message}`);
    process.exit(1);
  }

  console.error(`Error: ${String(error)}`);
  process.exit(1);
});
