import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createHashHistory, createBrowserHistory } from "@tanstack/react-router";

import "@xterm/xterm/css/xterm.css";
import "./index.css";

import { isElectron } from "./env";
import { getRouter } from "./router";
import { APP_DISPLAY_NAME } from "./branding";

function getSpectrumThemeFromSearch(): "light" | "dark" | null {
  const raw = new URLSearchParams(window.location.search).get("spectrumTheme");
  return raw === "light" || raw === "dark" ? raw : null;
}

function applyBootTheme() {
  const forcedTheme = getSpectrumThemeFromSearch();

  if (forcedTheme) {
    document.documentElement.classList.toggle("dark", forcedTheme === "dark");
    document.documentElement.style.colorScheme = forcedTheme;
    return;
  }

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", systemDark);
  document.documentElement.style.colorScheme = systemDark ? "dark" : "light";
}

applyBootTheme();

// Electron loads the app from a file-backed shell, so hash history avoids path resolution issues.
const history = isElectron ? createHashHistory() : createBrowserHistory();

const router = getRouter(history);

document.title = APP_DISPLAY_NAME;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
