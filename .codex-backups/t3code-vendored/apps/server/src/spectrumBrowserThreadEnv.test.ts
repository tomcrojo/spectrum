import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createSpectrumBrowserThreadEnv,
  getSpectrumBrowserThreadShimRootDir,
  resetSpectrumBrowserThreadShimRoot,
} from "./spectrumBrowserThreadEnv";

const ENV_KEYS = ["SPECTRUM_BROWSER", "SPECTRUM_BROWSER_CLI", "T3CODE_STATE_DIR"];
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const TEMP_DIRS = new Set<string>();

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const originalValue = ORIGINAL_ENV[key];
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
}

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TEMP_DIRS.add(dir);
  return dir;
}

afterEach(() => {
  restoreEnv();
  for (const dir of TEMP_DIRS) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  TEMP_DIRS.clear();
});

describe("spectrumBrowserThreadEnv", () => {
  it("creates browser shims pinned to one thread id", () => {
    const baseDir = makeTempDir("browser-thread-env-");
    const logPath = path.join(baseDir, "invocations.log");
    const realBrowserCliPath = path.join(
      baseDir,
      process.platform === "win32" ? "real-browser-cli.cmd" : "real-browser-cli",
    );
    const realBrowserPath = path.join(
      baseDir,
      process.platform === "win32" ? "real-browser.cmd" : "real-browser",
    );
    const recorder =
      process.platform === "win32"
        ? [
            "@echo off",
            `>>"${logPath}" echo %SPECTRUM_BROWSER_THREAD_ID%^|%*`,
            "",
          ].join("\r\n")
        : [
            "#!/bin/sh",
            `printf '%s\\n' \"$SPECTRUM_BROWSER_THREAD_ID|$*\" >> ${JSON.stringify(logPath)}`,
            "",
          ].join("\n");

    fs.writeFileSync(realBrowserCliPath, recorder, "utf8");
    fs.writeFileSync(realBrowserPath, recorder, "utf8");
    if (process.platform !== "win32") {
      fs.chmodSync(realBrowserCliPath, 0o755);
      fs.chmodSync(realBrowserPath, 0o755);
    }

    process.env.T3CODE_STATE_DIR = baseDir;
    process.env.SPECTRUM_BROWSER = realBrowserPath;
    process.env.SPECTRUM_BROWSER_CLI = realBrowserCliPath;

    const sessionEnv = createSpectrumBrowserThreadEnv("thread-1");

    expect(sessionEnv.env.SPECTRUM_BROWSER_THREAD_ID).toBe("thread-1");
    expect(sessionEnv.env.SPECTRUM_BROWSER).not.toBe(realBrowserPath);
    expect(sessionEnv.env.SPECTRUM_BROWSER_CLI).not.toBe(realBrowserCliPath);
    expect(sessionEnv.env.PATH?.startsWith(`${sessionEnv.shimDir}${path.delimiter}`)).toBe(true);

    execFileSync(sessionEnv.env.SPECTRUM_BROWSER_CLI!, ["list", "--json"], {
      env: sessionEnv.env,
    });

    expect(fs.readFileSync(logPath, "utf8")).toContain("thread-1|--thread thread-1 list --json");

    sessionEnv.cleanup();
    expect(fs.existsSync(sessionEnv.shimDir)).toBe(false);
  });

  it("clears stale shim directories when the embedded server starts", () => {
    const baseDir = makeTempDir("browser-thread-shim-root-");
    process.env.T3CODE_STATE_DIR = baseDir;

    const rootDir = getSpectrumBrowserThreadShimRootDir();
    const staleDir = path.join(rootDir, "stale-session");
    fs.mkdirSync(staleDir, { recursive: true });
    fs.writeFileSync(path.join(staleDir, "browser"), "stale", "utf8");

    resetSpectrumBrowserThreadShimRoot();

    expect(fs.existsSync(rootDir)).toBe(true);
    expect(fs.existsSync(staleDir)).toBe(false);
  });
});
