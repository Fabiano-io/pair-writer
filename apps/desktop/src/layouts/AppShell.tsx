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

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100">
      <ExplorerSidebar width={explorerWidth} />
      <ResizeHandle
        onResize={onExplorerResize}
        onResizeEnd={onExplorerResizeEnd}
      />
      <DocumentWorkspace
        chatWidth={chatWidth}
        onChatResize={onChatResize}
        onChatResizeEnd={onChatResizeEnd}
      />
    </div>
  );
}
