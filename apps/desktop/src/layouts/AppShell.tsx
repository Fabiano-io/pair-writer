import { useCallback, useState } from "react";
import { AppMenuBar } from "../components/AppMenuBar";
import { ExplorerSidebar } from "../features/explorer/ExplorerSidebar";
import { DocumentWorkspace } from "../features/workspace/DocumentWorkspace";
import { ResizeHandle } from "../components/ResizeHandle";
import { useWorkspaceLayout } from "../features/workspace/useWorkspaceLayout";

export function AppShell() {
  const {
    explorerWidth,
    chatWidth,
    explorerVisible,
    chatVisible,
    toggleExplorer,
    toggleChat,
    onExplorerResize,
    onExplorerResizeEnd,
    onChatResize,
    onChatResizeEnd,
  } = useWorkspaceLayout();

  const [documentToOpen, setDocumentToOpen] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [closeActiveTabRequested, setCloseActiveTabRequested] = useState(false);

  const handleDocumentOpened = useCallback(() => {
    setDocumentToOpen(null);
  }, []);

  const handleCloseActiveTab = useCallback(() => {
    setCloseActiveTabRequested(true);
  }, []);

  const handleCloseActiveTabHandled = useCallback(() => {
    setCloseActiveTabRequested(false);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <AppMenuBar
        hasActiveTab={activeDocumentId !== null}
        onCloseActiveTab={handleCloseActiveTab}
        onToggleExplorer={toggleExplorer}
        onToggleChat={toggleChat}
        explorerVisible={explorerVisible}
        chatVisible={chatVisible}
      />

      <div className="flex flex-1 overflow-hidden">
        {explorerVisible && (
          <>
            <ExplorerSidebar
              width={explorerWidth}
              activeDocumentId={activeDocumentId}
              onDocumentSelect={setDocumentToOpen}
            />
            <ResizeHandle
              onResize={onExplorerResize}
              onResizeEnd={onExplorerResizeEnd}
            />
          </>
        )}
        <DocumentWorkspace
          chatWidth={chatWidth}
          chatVisible={chatVisible}
          onChatResize={onChatResize}
          onChatResizeEnd={onChatResizeEnd}
          documentToOpen={documentToOpen}
          onDocumentOpened={handleDocumentOpened}
          onActiveTabChange={setActiveDocumentId}
          closeActiveTabRequested={closeActiveTabRequested}
          onCloseActiveTabHandled={handleCloseActiveTabHandled}
        />
      </div>
    </div>
  );
}
