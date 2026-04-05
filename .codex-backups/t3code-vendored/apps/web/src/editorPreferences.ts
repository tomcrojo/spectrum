import { EDITORS, EditorId, NativeApi } from "@t3tools/contracts";
import { getLocalStorageItem, setLocalStorageItem, useLocalStorage } from "./hooks/useLocalStorage";
import { useMemo } from "react";

const LAST_EDITOR_KEY = "t3code:last-editor";

export function usePreferredEditor(availableEditors: ReadonlyArray<EditorId>) {
  const [lastEditor, setLastEditor] = useLocalStorage(LAST_EDITOR_KEY, null, EditorId);

  const effectiveEditor = useMemo(() => {
    if (lastEditor && availableEditors.includes(lastEditor)) return lastEditor;
    return EDITORS.find((editor) => availableEditors.includes(editor.id))?.id ?? null;
  }, [lastEditor, availableEditors]);

  return [effectiveEditor, setLastEditor] as const;
}

export function resolveAndPersistPreferredEditor(
  availableEditors: readonly EditorId[],
): EditorId | null {
  const availableEditorIds = new Set(availableEditors);
  const stored = getLocalStorageItem(LAST_EDITOR_KEY, EditorId);
  if (stored && availableEditorIds.has(stored)) return stored;
  const editor = EDITORS.find((editor) => availableEditorIds.has(editor.id))?.id ?? null;
  if (editor) setLocalStorageItem(LAST_EDITOR_KEY, editor, EditorId);
  return editor ?? null;
}

function extractPathPosition(targetPath: string): {
  path: string;
  line?: number;
  column?: number;
} {
  let path = targetPath;
  let column: number | undefined;
  let line: number | undefined;

  const columnMatch = path.match(/:(\d+)$/);
  if (columnMatch?.[1]) {
    column = Number(columnMatch[1]);
    path = path.slice(0, -columnMatch[0].length);
  }

  const lineMatch = path.match(/:(\d+)$/);
  if (lineMatch?.[1]) {
    line = Number(lineMatch[1]);
    path = path.slice(0, -lineMatch[0].length);
  } else if (column !== undefined) {
    line = column;
    column = undefined;
  }

  return { path, line, column };
}

function postOpenFileToSpectrumParent(targetPath: string): boolean {
  if (typeof window === "undefined" || window.parent === window) {
    return false;
  }

  const payload = extractPathPosition(targetPath);
  if (!payload.path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(payload.path)) {
    return false;
  }

  window.parent.postMessage(
    {
      type: "spectrum:open-file",
      payload,
    },
    "*",
  );

  return true;
}

export async function openInPreferredEditor(api: NativeApi, targetPath: string): Promise<EditorId> {
  if (postOpenFileToSpectrumParent(targetPath)) {
    return "cursor";
  }

  const { availableEditors } = await api.server.getConfig();
  const editor = resolveAndPersistPreferredEditor(availableEditors);
  if (!editor) throw new Error("No available editors found.");
  await api.shell.openInEditor(targetPath, editor);
  return editor;
}
