import { ExplorerSidebar } from "../features/explorer/ExplorerSidebar";
import { DocumentWorkspace } from "../features/workspace/DocumentWorkspace";

export function AppShell() {
  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100">
      <ExplorerSidebar />
      <DocumentWorkspace />
    </div>
  );
}
