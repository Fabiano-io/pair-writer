import { useCallback, useState } from "react";
import { ExplorerSidebar } from "../features/explorer/ExplorerSidebar";
import { DocumentWorkspace } from "../features/workspace/DocumentWorkspace";
import { ResizeHandle } from "../components/ResizeHandle";
import { useWorkspaceLayout } from "../features/workspace/useWorkspaceLayout";

export function AppShell() {
  const {
    explorerWidth,
    chatWidth,
    onExplorerResize,
    onExplorerResizeEnd,
    onChatResize,
    onChatResizeEnd,
  } = useWorkspaceLayout();

  // Transient signal: which document the explorer wants opened.
  // Cleared by DocumentWorkspace after processing.
  const [documentToOpen, setDocumentToOpen] = useState<string | null>(null);

  // Mirrors the workspace's active tab so the explorer can highlight it.
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const handleDocumentOpened = useCallback(() => {
    setDocumentToOpen(null);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100">
      <ExplorerSidebar
        width={explorerWidth}
        activeDocumentId={activeDocumentId}
        onDocumentSelect={setDocumentToOpen}
      />
      <ResizeHandle
        onResize={onExplorerResize}
        onResizeEnd={onExplorerResizeEnd}
      />
      <DocumentWorkspace
        chatWidth={chatWidth}
        onChatResize={onChatResize}
        onChatResizeEnd={onChatResizeEnd}
        documentToOpen={documentToOpen}
        onDocumentOpened={handleDocumentOpened}
        onActiveTabChange={setActiveDocumentId}
      />
    </div>
  );
}
