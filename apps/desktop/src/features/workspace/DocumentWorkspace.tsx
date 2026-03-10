import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { DocumentPane } from "../document/DocumentPane";
import { DocumentChatPane } from "../chat/DocumentChatPane";
import { DocumentStatusBar } from "./DocumentStatusBar";
import { ResizeHandle } from "../../components/ResizeHandle";
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

/**
 * Approximate word count from HTML string. Local, provisional, compatible with
 * the current HTML content contract. Not an editorial-grade metric.
 */
function approximateWordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").filter(Boolean).length : 0;
}

function createInitialContentByTabId(): Record<string, string> {
  return INITIAL_OPEN_TAB_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: PROVISIONAL_CONTENT }),
    {} as Record<string, string>
  );
}

interface DocumentWorkspaceProps {
  chatWidth: number;
  chatVisible: boolean;
  onChatResize: (delta: number) => void;
  onChatResizeEnd: () => void;
  documentToOpen?: string | null;
  onDocumentOpened?: () => void;
  onActiveTabChange?: (id: string | null) => void;
  closeActiveTabRequested?: boolean;
  onCloseActiveTabHandled?: () => void;
}

export function DocumentWorkspace({
  chatWidth,
  chatVisible,
  onChatResize,
  onChatResizeEnd,
  documentToOpen,
  onDocumentOpened,
  onActiveTabChange,
  closeActiveTabRequested,
  onCloseActiveTabHandled,
}: DocumentWorkspaceProps) {
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

  useEffect(() => {
    onActiveTabChange?.(activeTabId);
  }, [activeTabId, onActiveTabChange]);

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

  useEffect(() => {
    if (!documentToOpen) return;

    const docExists = WORKSPACE_DOCUMENTS.some((d) => d.id === documentToOpen);
    if (!docExists) {
      onDocumentOpened?.();
      return;
    }

    setOpenTabIds((prev) => {
      if (prev.includes(documentToOpen)) return prev;
      return [...prev, documentToOpen];
    });

    setContentByTabId((prev) => {
      if (prev[documentToOpen] !== undefined) return prev;
      pristineByDocIdRef.current[documentToOpen] = true;
      const gen = (loadGenerationRef.current[documentToOpen] ?? 0) + 1;
      loadGenerationRef.current[documentToOpen] = gen;
      loadDocumentContent(documentToOpen).then((html) => {
        if (
          (loadGenerationRef.current[documentToOpen] ?? 0) === gen &&
          pristineByDocIdRef.current[documentToOpen]
        ) {
          setContentByTabId((prev) => ({ ...prev, [documentToOpen]: html ?? PROVISIONAL_CONTENT }));
        }
      });
      return { ...prev, [documentToOpen]: PROVISIONAL_CONTENT };
    });

    setActiveTabId(documentToOpen);
    onDocumentOpened?.();
  }, [documentToOpen, onDocumentOpened]);

  const onTabClose = useCallback(
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

  useEffect(() => {
    if (!closeActiveTabRequested || !activeTabId) {
      if (closeActiveTabRequested) onCloseActiveTabHandled?.();
      return;
    }
    onTabClose(activeTabId);
    onCloseActiveTabHandled?.();
  }, [closeActiveTabRequested, activeTabId, onTabClose, onCloseActiveTabHandled]);

  const onTabSelect = useCallback(
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

  const hasActiveTab = activeTabId !== null && activeDocument !== undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-900">
      <WorkspaceTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
      />

      <div className="flex flex-1 overflow-hidden">
        {hasActiveTab ? (
          <>
            <DocumentPane
              title={activeDocument.label}
              content={contentByTabId[activeTabId] ?? PROVISIONAL_CONTENT}
              onContentChange={handleContentChange}
            />
            {chatVisible && (
              <>
                <ResizeHandle
                  onResize={onChatResize}
                  onResizeEnd={onChatResizeEnd}
                />
                <DocumentChatPane
                  documentTitle={activeDocument.label}
                  width={chatWidth}
                />
              </>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
            No document open
          </div>
        )}
      </div>

      <DocumentStatusBar
        hasActiveTab={hasActiveTab}
        activeDocumentLabel={activeDocument?.label ?? ""}
        wordCount={
          hasActiveTab
            ? approximateWordCount(
                contentByTabId[activeTabId] ?? PROVISIONAL_CONTENT
              )
            : 0
        }
        chatVisible={chatVisible}
      />
    </div>
  );
}
