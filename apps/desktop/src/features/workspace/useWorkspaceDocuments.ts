import { useCallback, useMemo, useRef, useState } from "react";
import {
  WORKSPACE_DOCUMENTS,
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
import { loadSettings } from "../settings/appSettings";

const CATALOG_IDS = new Set(WORKSPACE_DOCUMENTS.map((d) => d.id));

function isProjectFileId(id: string): boolean {
  return id.includes("/") || id.includes("\\");
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}


export type CloseConfirmAction = "save" | "discard" | "cancel";

export function useWorkspaceDocuments() {
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [contentByTabId, setContentByTabId] = useState<Record<string, string>>(
    {}
  );
  const [savedContentByTabId, setSavedContentByTabId] = useState<
    Record<string, string>
  >({});
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(
    null
  );

  const loadGenerationRef = useRef<Record<string, number>>({});

  const dirtyTabIds = useMemo(() => {
    const dirty = new Set<string>();
    for (const id of openTabIds) {
      const current = contentByTabId[id];
      const saved = savedContentByTabId[id];
      if (current !== undefined && saved !== undefined && current !== saved) {
        dirty.add(id);
      }
    }
    return dirty;
  }, [openTabIds, contentByTabId, savedContentByTabId]);

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
      WORKSPACE_DOCUMENTS.find((d) => d.id === activeTabId) ??
      (activeTabId
        ? { id: activeTabId, label: basename(activeTabId), group: "" }
        : undefined),
    [activeTabId]
  );

  const hasActiveTab = activeTabId !== null && activeDocument !== undefined;

  const persistDocument = useCallback(
    async (docId: string, documentContent: string) => {
      if (CATALOG_IDS.has(docId)) {
        await saveDocumentContent(docId, documentContent);
      } else if (isProjectFileId(docId)) {
        const settings = await loadSettings();
        const projectRoot = settings.projectRootPath ?? undefined;
        await saveFileContent(docId, documentContent, projectRoot);
      }
    },
    []
  );

  const saveDocument = useCallback(
    async (docId: string) => {
      const content = contentByTabId[docId];
      if (content === undefined) return;
      await persistDocument(docId, content);
      setSavedContentByTabId((prev) => ({ ...prev, [docId]: content }));
    },
    [contentByTabId, persistDocument]
  );

  const saveActiveDocument = useCallback(async () => {
    if (activeTabId) await saveDocument(activeTabId);
  }, [activeTabId, saveDocument]);

  const openDocument = useCallback(
    (documentId: string) => {
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

      const placeholder = "";
      setContentByTabId((prev) => ({ ...prev, [documentId]: placeholder }));
      setSavedContentByTabId((prev) => ({ ...prev, [documentId]: placeholder }));

      const gen = (loadGenerationRef.current[documentId] ?? 0) + 1;
      loadGenerationRef.current[documentId] = gen;

      const isStale = (id: string) =>
        (loadGenerationRef.current[id] ?? 0) !== gen;

      if (isProject && isSupportedFile(documentId)) {
        loadSettings()
          .then((s) => s.projectRootPath ?? undefined)
          .then((projectRoot) =>
            readFileContent(documentId, projectRoot).then((text) => {
              if (isStale(documentId)) return;
              const loadedContent = text;
              setSavedContentByTabId((prev) => ({ ...prev, [documentId]: loadedContent }));
              setContentByTabId((prev) => ({ ...prev, [documentId]: loadedContent }));
            })
          )
          .catch(() => {
            if (isStale(documentId)) return;
            setSavedContentByTabId((prev) => ({ ...prev, [documentId]: placeholder }));
          });
      } else if (isCatalog) {
        loadDocumentContent(documentId).then((html) => {
          if (isStale(documentId)) return;
          const loaded = html ?? placeholder;
          setSavedContentByTabId((prev) => ({ ...prev, [documentId]: loaded }));
          setContentByTabId((prev) => ({ ...prev, [documentId]: loaded }));
        });
      }

      setActiveTabId(documentId);
    },
    [openTabIds, contentByTabId]
  );

  const performClose = useCallback(
    (id: string) => {
      delete loadGenerationRef.current[id];

      setSavedContentByTabId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setContentByTabId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

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
    [activeTabId]
  );

  const closeDocument = useCallback(
    (id: string) => {
      const current = contentByTabId[id];
      const saved = savedContentByTabId[id];
      const isDirty =
        current !== undefined && saved !== undefined && current !== saved;

      if (isDirty) {
        setPendingCloseTabId(id);
      } else {
        performClose(id);
      }
    },
    [contentByTabId, performClose, savedContentByTabId]
  );

  const confirmClose = useCallback(
    async (action: CloseConfirmAction) => {
      const id = pendingCloseTabId;
      setPendingCloseTabId(null);
      if (!id) return;

      if (action === "cancel") return;

      if (action === "save") {
        const content = contentByTabId[id];
        if (content !== undefined) {
          await persistDocument(id, content);
          setSavedContentByTabId((prev) => ({ ...prev, [id]: content }));
        }
      }

      performClose(id);
    },
    [pendingCloseTabId, contentByTabId, persistDocument, performClose]
  );

  const renameDocumentPath = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;

    delete loadGenerationRef.current[fromId];

    setOpenTabIds((prev) => {
      const index = prev.indexOf(fromId);
      if (index === -1) return prev;

      const next = [...prev];
      next.splice(index, 1);

      if (!next.includes(toId)) {
        next.splice(index, 0, toId);
      }

      return next;
    });

    setContentByTabId((prev) => {
      if (!(fromId in prev)) return prev;

      const next = { ...prev };
      if (!(toId in next)) {
        next[toId] = next[fromId];
      }
      delete next[fromId];
      return next;
    });

    setSavedContentByTabId((prev) => {
      if (!(fromId in prev)) return prev;

      const next = { ...prev };
      if (!(toId in next)) {
        next[toId] = next[fromId];
      }
      delete next[fromId];
      return next;
    });

    setActiveTabId((prev) => (prev === fromId ? toId : prev));
    setPendingCloseTabId((prev) => (prev === fromId ? toId : prev));
  }, []);

  const closeActiveTab = useCallback(() => {
    if (activeTabId) closeDocument(activeTabId);
  }, [activeTabId, closeDocument]);

  const selectDocument = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const handleContentChange = useCallback(
    (content: string) => {
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
    dirtyTabIds,
    pendingCloseTabId,
    openDocument,
    closeDocument,
    renameDocumentPath,
    selectDocument,
    closeActiveTab,
    saveActiveDocument,
    confirmClose,
    handleContentChange,
  };
}
