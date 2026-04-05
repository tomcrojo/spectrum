#!/usr/bin/env node

import { main } from "../src/cli.js";
import { BrowserCliError, wrapError } from "../src/errors.js";

const rawArgv = process.argv.slice(2);
const jsonRequested = rawArgv.includes("--json");

main(rawArgv).catch((error) => {
  const wrapped = wrapError(error, "Browser CLI execution failed");
  if (wrapped instanceof BrowserCliError) {
    if (jsonRequested) {
      console.error(JSON.stringify({ error: wrapped.message, code: wrapped.code, hints: Array.isArray(wrapped.hints) ? wrapped.hints : [] }, null, 2));
    } else {
      const lines = [`Error: ${wrapped.message}`];
      if (Array.isArray(wrapped.hints) && wrapped.hints.length > 0) {
        lines.push("", "Hints:");
        for (const hint of wrapped.hints) lines.push(`- ${hint}`);
      }
      console.error(lines.join("\n"));
    }
    process.exit(1);
  }

  if (jsonRequested) {
    console.error(JSON.stringify({ error: String(error), code: "INTERNAL_ERROR", hints: [] }, null, 2));
  } else {
    console.error(`Error: ${String(error)}`);
  }
  process.exit(1);
});
