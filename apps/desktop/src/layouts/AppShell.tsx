import { useCallback, useEffect, useState } from "react";
import { AppMenuBar } from "../components/AppMenuBar";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { ExplorerSidebar } from "../features/explorer/ExplorerSidebar";
import { DocumentWorkspace } from "../features/workspace/DocumentWorkspace";
import { ResizeHandle } from "../components/ResizeHandle";
import { useWorkspaceLayout } from "../features/workspace/useWorkspaceLayout";
import { useWorkspaceDocuments } from "../features/workspace/useWorkspaceDocuments";
import { loadSettings } from "../features/settings/appSettings";

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

  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then((s) => setProjectRootPath(s.projectRootPath ?? null));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadSettings().then((s) =>
        setProjectRootPath(s.projectRootPath ?? null)
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const isSaveable =
    workspace.hasActiveTab &&
    workspace.activeTabId !== null &&
    workspace.dirtyTabIds.has(workspace.activeTabId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isSaveable) {
          workspace.saveActiveDocument();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSaveable, workspace.saveActiveDocument]);

  const [newDocTrigger, setNewDocTrigger] = useState(0);

  const handleNewDocumentFromMenu = useCallback(() => {
    if (!explorerVisible) toggleExplorer();
    setNewDocTrigger((n) => n + 1);
  }, [explorerVisible, toggleExplorer]);

  const pendingCloseDoc = workspace.pendingCloseTabId
    ? workspace.tabs.find((t) => t.id === workspace.pendingCloseTabId)
    : null;

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <AppMenuBar
        hasActiveTab={workspace.hasActiveTab}
        isSaveable={isSaveable}
        hasProject={projectRootPath !== null}
        onCloseActiveTab={workspace.closeActiveTab}
        onSave={() => workspace.saveActiveDocument()}
        onNewDocument={handleNewDocumentFromMenu}
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
              onCreateDocument={workspace.openDocument}
              newDocTrigger={newDocTrigger}
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
          dirtyTabIds={workspace.dirtyTabIds}
          onTabSelect={workspace.selectDocument}
          onTabClose={workspace.closeDocument}
          onContentChange={workspace.handleContentChange}
        />
      </div>

      {pendingCloseDoc && (
        <UnsavedChangesDialog
          documentName={pendingCloseDoc.label}
          onSave={() => workspace.confirmClose("save")}
          onDiscard={() => workspace.confirmClose("discard")}
          onCancel={() => workspace.confirmClose("cancel")}
        />
      )}
    </div>
  );
}
