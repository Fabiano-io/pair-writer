import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { DocumentPane } from "../document/DocumentPane";
import { DocumentChatPane } from "../chat/DocumentChatPane";
import { ResizeHandle } from "../../components/ResizeHandle";
import {
  WORKSPACE_DOCUMENTS,
  INITIAL_OPEN_TAB_IDS,
  PROVISIONAL_CONTENT,
} from "./workspaceDocuments";

function createInitialContentByTabId(): Record<string, string> {
  return INITIAL_OPEN_TAB_IDS.reduce(
    (acc, id) => ({ ...acc, [id]: PROVISIONAL_CONTENT }),
    {} as Record<string, string>
  );
}

interface DocumentWorkspaceProps {
  chatWidth: number;
  onChatResize: (delta: number) => void;
  onChatResizeEnd: () => void;
  /** Transient signal: id of a document the explorer wants opened/activated. */
  documentToOpen?: string | null;
  /** Called after the workspace has processed the documentToOpen signal. */
  onDocumentOpened?: () => void;
  /** Reports the current active tab id back to the shell (for explorer highlight). */
  onActiveTabChange?: (id: string | null) => void;
}

export function DocumentWorkspace({
  chatWidth,
  onChatResize,
  onChatResizeEnd,
  documentToOpen,
  onDocumentOpened,
  onActiveTabChange,
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

  const tabs = useMemo(
    () => WORKSPACE_DOCUMENTS.filter((d) => openTabIds.includes(d.id)),
    [openTabIds]
  );

  const activeDocument = useMemo(
    () => WORKSPACE_DOCUMENTS.find((d) => d.id === activeTabId),
    [activeTabId]
  );

  // --- Report active tab changes to the shell ---
  useEffect(() => {
    onActiveTabChange?.(activeTabId);
  }, [activeTabId, onActiveTabChange]);

  // --- Process incoming documentToOpen signal from the explorer ---
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
      return { ...prev, [documentToOpen]: PROVISIONAL_CONTENT };
    });

    setActiveTabId(documentToOpen);
    onDocumentOpened?.();
  }, [documentToOpen, onDocumentOpened]);

  const onTabSelect = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const onTabClose = useCallback(
    (id: string) => {
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

  const handleContentChange = useCallback(
    (content: string) => {
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
            <ResizeHandle
              onResize={onChatResize}
              onResizeEnd={onChatResizeEnd}
            />
            <DocumentChatPane
              documentTitle={activeDocument.label}
              width={chatWidth}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
            No document open
          </div>
        )}
      </div>
    </div>
  );
}
