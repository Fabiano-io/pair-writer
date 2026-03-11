import { AppMenuBar } from "../components/AppMenuBar";
import { ExplorerSidebar } from "../features/explorer/ExplorerSidebar";
import { DocumentWorkspace } from "../features/workspace/DocumentWorkspace";
import { ResizeHandle } from "../components/ResizeHandle";
import { useWorkspaceLayout } from "../features/workspace/useWorkspaceLayout";
import { useWorkspaceDocuments } from "../features/workspace/useWorkspaceDocuments";

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

  const workspace = useWorkspaceDocuments();

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <AppMenuBar
        hasActiveTab={workspace.hasActiveTab}
        onCloseActiveTab={workspace.closeActiveTab}
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
              activeDocumentId={workspace.activeTabId}
              onFileSelect={workspace.openDocument}
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
          tabs={workspace.tabs}
          activeTabId={workspace.activeTabId}
          activeDocument={workspace.activeDocument}
          contentByTabId={workspace.contentByTabId}
          hasActiveTab={workspace.hasActiveTab}
          onTabSelect={workspace.selectDocument}
          onTabClose={workspace.closeDocument}
          onContentChange={workspace.handleContentChange}
        />
      </div>
    </div>
  );
}
