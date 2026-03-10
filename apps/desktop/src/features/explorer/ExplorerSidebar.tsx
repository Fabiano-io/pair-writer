import { useMemo } from "react";
import {
  WORKSPACE_DOCUMENTS,
  type WorkspaceDocument,
} from "../workspace/workspaceDocuments";

interface ExplorerSidebarProps {
  width: number;
  activeDocumentId: string | null;
  onDocumentSelect: (id: string) => void;
}

function groupDocuments(
  docs: WorkspaceDocument[]
): { group: string; items: WorkspaceDocument[] }[] {
  const map = new Map<string, WorkspaceDocument[]>();
  for (const doc of docs) {
    const list = map.get(doc.group) ?? [];
    list.push(doc);
    map.set(doc.group, list);
  }
  return Array.from(map, ([group, items]) => ({ group, items }));
}

export function ExplorerSidebar({
  width,
  activeDocumentId,
  onDocumentSelect,
}: ExplorerSidebarProps) {
  const groups = useMemo(() => groupDocuments(WORKSPACE_DOCUMENTS), []);

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950"
      style={{ width }}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="text-base">✦</span>
        <span className="text-sm font-semibold tracking-wide text-zinc-200">
          Pair Writer
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map(({ group, items }) => (
          <div key={group} className="mb-4">
            <h3 className="mb-1 px-2 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
              {group}
            </h3>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const isActive = item.id === activeDocumentId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onDocumentSelect(item.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-zinc-800/70 text-zinc-100"
                          : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-xs opacity-60">📄</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
