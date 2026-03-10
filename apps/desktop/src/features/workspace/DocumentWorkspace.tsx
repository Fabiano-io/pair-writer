import { useCallback, useMemo, useState } from "react";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { DocumentPane } from "../document/DocumentPane";
import { DocumentChatPane } from "../chat/DocumentChatPane";
import { ResizeHandle } from "../../components/ResizeHandle";

const TAB_DOCUMENTS = [
  { id: "product-vision", label: "Product Vision" },
  { id: "context-engine", label: "Context Engine" },
  { id: "checkpoints", label: "Checkpoints" },
] as const;

const PROVISIONAL_CONTENT = `Pair Writer is a desktop writing environment designed for structured thinking and AI-assisted content creation. It combines a focused document editor with contextual AI chat that lives alongside each document.

The core experience prioritizes rendered content over raw markup, delivering an editorial feel that keeps writers immersed in their ideas rather than formatting syntax.

[This is a transitional plain text area. The real TipTap rich-text engine will replace this space.]`;

function createInitialContentByTabId(): Record<string, string> {
  return TAB_DOCUMENTS.reduce(
    (acc, tab) => ({ ...acc, [tab.id]: PROVISIONAL_CONTENT }),
    {}
  );
}

interface DocumentWorkspaceProps {
  chatWidth: number;
  onChatResize: (delta: number) => void;
  onChatResizeEnd: () => void;
}

export function DocumentWorkspace({
  chatWidth,
  onChatResize,
  onChatResizeEnd,
}: DocumentWorkspaceProps) {
  const [openTabIds, setOpenTabIds] = useState<string[]>(() =>
    TAB_DOCUMENTS.map((t) => t.id)
  );
  const [activeTabId, setActiveTabId] = useState<string | null>(
    TAB_DOCUMENTS[0]?.id ?? null
  );
  const [contentByTabId, setContentByTabId] = useState<Record<string, string>>(
    createInitialContentByTabId
  );

  const tabs = useMemo(
    () => TAB_DOCUMENTS.filter((t) => openTabIds.includes(t.id)),
    [openTabIds]
  );

  const activeDocument = useMemo(
    () => TAB_DOCUMENTS.find((t) => t.id === activeTabId),
    [activeTabId]
  );

  const onTabSelect = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const onTabClose = useCallback((id: string) => {
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
  }, [activeTabId]);

  const handleContentChange = useCallback((content: string) => {
    setContentByTabId((prev) =>
      activeTabId ? { ...prev, [activeTabId]: content } : prev
    );
  }, [activeTabId]);

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
            <ResizeHandle onResize={onChatResize} onResizeEnd={onChatResizeEnd} />
            <DocumentChatPane
              documentTitle={activeDocument.label}
              width={chatWidth}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-zinc-600 text-sm">
            No document open
          </div>
        )}
      </div>
    </div>
  );
}
