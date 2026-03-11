import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WORKSPACE_DOCUMENTS,
  PROVISIONAL_CONTENT,
} from "./workspaceDocuments";
import {
  loadDocumentContent,
  saveDocumentContent,
} from "./documentStorage";
import {
  readFileContent,
  saveFileContent,
  isSupportedFile,
} from "../project/projectAccess";
import { textToSimpleHtml, htmlToPlainText } from "../project/textContentUtils";
import { loadSettings } from "../settings/appSettings";

const SAVE_DEBOUNCE_MS = 500;
const CATALOG_IDS = new Set(WORKSPACE_DOCUMENTS.map((d) => d.id));

/** Operational id is normalized path. Not final document identity. */
function isProjectFileId(id: string): boolean {
  return id.includes("/") || id.includes("\\");
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}

function needsTextConversion(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".txt");
}

export function useWorkspaceDocuments() {
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [contentByTabId, setContentByTabId] = useState<Record<string, string>>(
    {}
  );

  const loadGenerationRef = useRef<Record<string, number>>({});
  const pristineByDocIdRef = useRef<Record<string, boolean>>({});
  const pendingSaveRef = useRef<{ documentId: string; content: string } | null>(
    null
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingSave = useCallback(async () => {
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    if (CATALOG_IDS.has(pending.documentId)) {
      saveDocumentContent(pending.documentId, pending.content);
    } else if (isProjectFileId(pending.documentId)) {
      const settings = await loadSettings();
      const projectRoot = settings.projectRootPath ?? undefined;
      let content = pending.content;
      if (needsTextConversion(pending.documentId)) {
        content = htmlToPlainText(content);
      }
      await saveFileContent(pending.documentId, content, projectRoot);
    }
  }, []);

  useEffect(() => {
    return () => {
      void flushPendingSave();
    };
  }, [flushPendingSave]);

  useEffect(() => {
    const handler = () => flushPendingSave();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flushPendingSave]);

  const tabs = useMemo(
    () =>
      openTabIds.map((id) => {
        const catalogDoc = WORKSPACE_DOCUMENTS.find((d) => d.id === id);
        if (catalogDoc) return { id: catalogDoc.id, label: catalogDoc.label };
        return { id, label: basename(id) };
      }),
    [openTabIds]
  );

  const activeDocument = useMemo(
    () =>
      WORKSPACE_DOCUMENTS.find((d) => d.id === activeTabId) ?? (activeTabId ? { id: activeTabId, label: basename(activeTabId), group: "" } : undefined),
    [activeTabId]
  );

  const hasActiveTab = activeTabId !== null && activeDocument !== undefined;

  const openDocument = useCallback((documentId: string) => {
    const isProject = isProjectFileId(documentId);
    const isCatalog = CATALOG_IDS.has(documentId);

    if (!isProject && !isCatalog) return;

    if (openTabIds.includes(documentId)) {
      setActiveTabId(documentId);
      return;
    }

    setOpenTabIds((prev) => [...prev, documentId]);

    if (contentByTabId[documentId] !== undefined) {
      setActiveTabId(documentId);
      return;
    }

    setContentByTabId((prev) => ({
      ...prev,
      [documentId]: PROVISIONAL_CONTENT,
    }));
    pristineByDocIdRef.current[documentId] = true;
    const gen = (loadGenerationRef.current[documentId] ?? 0) + 1;
    loadGenerationRef.current[documentId] = gen;

    if (isProject && isSupportedFile(documentId)) {
      loadSettings().then((s) => s.projectRootPath ?? undefined).then((projectRoot) =>
        readFileContent(documentId, projectRoot)
          .then((text) => {
            if (
              (loadGenerationRef.current[documentId] ?? 0) === gen &&
              pristineByDocIdRef.current[documentId]
            ) {
              const html = needsTextConversion(documentId)
                ? textToSimpleHtml(text)
                : text;
              setContentByTabId((prev) => ({ ...prev, [documentId]: html }));
            }
          })
          .catch(() => {
            setContentByTabId((prev) => ({
              ...prev,
              [documentId]: PROVISIONAL_CONTENT,
            }));
          })
      );
    } else if (isCatalog) {
      loadDocumentContent(documentId).then((html) => {
        if (
          (loadGenerationRef.current[documentId] ?? 0) === gen &&
          pristineByDocIdRef.current[documentId]
        ) {
          setContentByTabId((prev) => ({
            ...prev,
            [documentId]: html ?? PROVISIONAL_CONTENT,
          }));
        }
      });
    }

    setActiveTabId(documentId);
  }, [openTabIds, contentByTabId]);

  const closeDocument = useCallback(
    (id: string) => {
      flushPendingSave();
      setOpenTabIds((prev) => {
        const next = prev.filter((tabId) => tabId !== id);
        if (next.length === 0) {
          setActiveTabId(null);
          return [];
        }
        if (activeTabId === id) {
          const idx = prev.indexOf(id);
          const nextActiveIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[nextActiveIdx]);
        }
        return next;
      });
    },
    [activeTabId, flushPendingSave]
  );

  const closeActiveTab = useCallback(() => {
    if (activeTabId) closeDocument(activeTabId);
  }, [activeTabId, closeDocument]);

  const selectDocument = useCallback(
    (id: string) => {
      flushPendingSave();
      setActiveTabId(id);
    },
    [flushPendingSave]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (activeTabId) {
        pristineByDocIdRef.current[activeTabId] = false;
        if (saveTimeoutRef.current !== null) {
          clearTimeout(saveTimeoutRef.current);
        }
        pendingSaveRef.current = { documentId: activeTabId, content };
        saveTimeoutRef.current = setTimeout(() => {
          flushPendingSave();
          saveTimeoutRef.current = null;
        }, SAVE_DEBOUNCE_MS);
      }
      setContentByTabId((prev) =>
        activeTabId ? { ...prev, [activeTabId]: content } : prev
      );
    },
    [activeTabId]
  );

  return {
    openTabIds,
    activeTabId,
    contentByTabId,
    tabs,
    activeDocument,
    hasActiveTab,
    openDocument,
    closeDocument,
    selectDocument,
    closeActiveTab,
    handleContentChange,
  };
}
