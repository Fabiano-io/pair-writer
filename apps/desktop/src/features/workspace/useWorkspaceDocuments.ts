import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WORKSPACE_DOCUMENTS,
  INITIAL_OPEN_TAB_IDS,
  PROVISIONAL_CONTENT,
} from "./workspaceDocuments";
import {
  loadDocumentContent,
  saveDocumentContent,
} from "./documentStorage";

const SAVE_DEBOUNCE_MS = 500;
const CATALOG_IDS = new Set(WORKSPACE_DOCUMENTS.map((d) => d.id));

function createInitialContentByTabId(): Record<string, string> {
  return INITIAL_OPEN_TAB_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: PROVISIONAL_CONTENT }),
    {} as Record<string, string>
  );
}

export function useWorkspaceDocuments() {
  const [openTabIds, setOpenTabIds] = useState<string[]>(
    () => [...INITIAL_OPEN_TAB_IDS]
  );
  const [activeTabId, setActiveTabId] = useState<string | null>(
    INITIAL_OPEN_TAB_IDS[0] ?? null
  );
  const [contentByTabId, setContentByTabId] = useState<Record<string, string>>(
    createInitialContentByTabId
  );

  const loadGenerationRef = useRef<Record<string, number>>({});
  const pristineByDocIdRef = useRef<Record<string, boolean>>({});
  const pendingSaveRef = useRef<{ documentId: string; content: string } | null>(
    null
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingSave = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (pending && CATALOG_IDS.has(pending.documentId)) {
      saveDocumentContent(pending.documentId, pending.content);
      pendingSaveRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => flushPendingSave();
  }, [flushPendingSave]);

  useEffect(() => {
    const handler = () => flushPendingSave();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [flushPendingSave]);

  const tabs = useMemo(
    () => WORKSPACE_DOCUMENTS.filter((d) => openTabIds.includes(d.id)),
    [openTabIds]
  );

  const activeDocument = useMemo(
    () => WORKSPACE_DOCUMENTS.find((d) => d.id === activeTabId),
    [activeTabId]
  );

  const hasActiveTab = activeTabId !== null && activeDocument !== undefined;

  useEffect(() => {
    INITIAL_OPEN_TAB_IDS.forEach((id) => {
      pristineByDocIdRef.current[id] = true;
      const gen = (loadGenerationRef.current[id] ?? 0) + 1;
      loadGenerationRef.current[id] = gen;
      loadDocumentContent(id).then((html) => {
        if (
          html !== null &&
          (loadGenerationRef.current[id] ?? 0) === gen &&
          pristineByDocIdRef.current[id]
        ) {
          setContentByTabId((prev) => ({ ...prev, [id]: html }));
        }
      });
    });
  }, []);

  const openDocument = useCallback((documentId: string) => {
    const docExists = WORKSPACE_DOCUMENTS.some((d) => d.id === documentId);
    if (!docExists) return;

    setOpenTabIds((prev) => {
      if (prev.includes(documentId)) return prev;
      return [...prev, documentId];
    });

    setContentByTabId((prev) => {
      if (prev[documentId] !== undefined) return prev;
      pristineByDocIdRef.current[documentId] = true;
      const gen = (loadGenerationRef.current[documentId] ?? 0) + 1;
      loadGenerationRef.current[documentId] = gen;
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
      return { ...prev, [documentId]: PROVISIONAL_CONTENT };
    });

    setActiveTabId(documentId);
  }, []);

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
          if (
            pendingSaveRef.current &&
            CATALOG_IDS.has(pendingSaveRef.current.documentId)
          ) {
            saveDocumentContent(
              pendingSaveRef.current.documentId,
              pendingSaveRef.current.content
            );
          }
          pendingSaveRef.current = null;
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
