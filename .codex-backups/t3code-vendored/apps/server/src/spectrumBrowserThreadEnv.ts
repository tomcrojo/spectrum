import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { delimiter, join } from "node:path";

export interface SpectrumBrowserThreadSessionEnv {
  readonly env: NodeJS.ProcessEnv;
  readonly shimDir: string;
  readonly cleanup: () => void;
}

function getSpectrumBrowserThreadShimRootDir(): string {
  return join(
    process.env.T3CODE_STATE_DIR ?? process.env.T3CODE_HOME ?? os.tmpdir(),
    "browser-cli-thread-shims",
  );
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function sanitizePathSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : "thread";
}

function prependPath(entry: string, existingPath: string | undefined): string {
  if (!existingPath) {
    return entry;
  }

  return [entry, ...existingPath.split(delimiter).filter(Boolean)].join(delimiter);
}

function getRealBrowserCommandPath(env: NodeJS.ProcessEnv, key: "SPECTRUM_BROWSER" | "SPECTRUM_BROWSER_CLI"): string {
  const commandPath = env[key];
  if (!commandPath) {
    throw new Error(`Missing ${key} in the embedded T3Code runtime environment.`);
  }

  return commandPath;
}

function buildShimInvocation(commandPath: string, threadId: string): string {
  if (commandPath.endsWith(".js")) {
    return `${shellQuote(process.execPath)} ${shellQuote(commandPath)} --thread ${shellQuote(threadId)} "$@"`;
  }

  return `${shellQuote(commandPath)} --thread ${shellQuote(threadId)} "$@"`;
}

function buildPosixShimScript(commandPath: string, threadId: string): string {
  return [
    "#!/bin/sh",
    `export SPECTRUM_BROWSER_THREAD_ID=${shellQuote(threadId)}`,
    `exec ${buildShimInvocation(commandPath, threadId)}`,
    "",
  ].join("\n");
}

function buildWindowsShimScript(commandPath: string, threadId: string): string {
  const executable = commandPath.endsWith(".js")
    ? `"${process.execPath}" "${commandPath}"`
    : `"${commandPath}"`;

  return [
    "@echo off",
    `set "SPECTRUM_BROWSER_THREAD_ID=${threadId}"`,
    `${executable} --thread "${threadId}" %*`,
    "",
  ].join("\r\n");
}

function writeShimScript(filePath: string, commandPath: string, threadId: string): void {
  const contents =
    process.platform === "win32"
      ? buildWindowsShimScript(commandPath, threadId)
      : buildPosixShimScript(commandPath, threadId);

  writeFileSync(filePath, contents, "utf8");
  if (process.platform !== "win32") {
    chmodSync(filePath, 0o755);
  }
}

export function resetSpectrumBrowserThreadShimRoot(): void {
  const rootDir = getSpectrumBrowserThreadShimRootDir();
  rmSync(rootDir, { recursive: true, force: true });
  mkdirSync(rootDir, { recursive: true });
}

export function createSpectrumBrowserThreadEnv(
  threadId: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): SpectrumBrowserThreadSessionEnv {
  const browserCommand = getRealBrowserCommandPath(baseEnv, "SPECTRUM_BROWSER");
  const browserCliCommand = getRealBrowserCommandPath(baseEnv, "SPECTRUM_BROWSER_CLI");
  const rootDir = getSpectrumBrowserThreadShimRootDir();
  const shimDir = join(rootDir, `${sanitizePathSegment(threadId)}-${randomUUID()}`);
  const browserShimPath = join(shimDir, process.platform === "win32" ? "browser.cmd" : "browser");
  const browserCliShimPath = join(
    shimDir,
    process.platform === "win32" ? "browser-cli.cmd" : "browser-cli",
  );

  mkdirSync(shimDir, { recursive: true });
  writeShimScript(browserShimPath, browserCommand, threadId);
  writeShimScript(browserCliShimPath, browserCliCommand, threadId);

  return {
    env: {
      ...baseEnv,
      PATH: prependPath(shimDir, baseEnv.PATH),
      SPECTRUM_BROWSER: browserShimPath,
      SPECTRUM_BROWSER_CLI: browserCliShimPath,
      SPECTRUM_BROWSER_THREAD_ID: threadId,
    },
    shimDir,
    cleanup: () => {
      rmSync(shimDir, { recursive: true, force: true });
    },
  };
}

export { getSpectrumBrowserThreadShimRootDir };
