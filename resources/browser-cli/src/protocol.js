import os from "node:os";
import path from "node:path";

function getDefaultUserDataDir() {
  if (process.env.CENTIPEDE_USER_DATA_DIR) {
    return process.env.CENTIPEDE_USER_DATA_DIR;
  }

  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", "centipede");
    case "win32":
      return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "centipede");
    default:
      return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "centipede");
  }
}

export function getSessionFilePath() {
  return (
    process.env.CENTIPEDE_BROWSER_SESSION_FILE ??
    path.join(getDefaultUserDataDir(), "browser-cli", "sessions.json")
  );
}

export function getBrowserCliTmpDir() {
  return path.join(getDefaultUserDataDir(), "browser-cli", "tmp");
}

export function normalizeConnectArg(value) {
  if (value === true || value === "auto" || value == null) {
    return "auto";
  }

  return String(value);
}
