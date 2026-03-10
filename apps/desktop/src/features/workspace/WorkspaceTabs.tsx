export interface WorkspaceTab {
  id: string;
  label: string;
}

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
}

export function WorkspaceTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
}: WorkspaceTabsProps) {
  return (
    <div className="flex shrink-0 items-end gap-0 border-b border-zinc-800 bg-zinc-950 px-2 pt-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabSelect(tab.id)}
            className={`group relative flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm transition-colors ${
              isActive
                ? "bg-zinc-900 text-zinc-100 font-medium"
                : "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
            }`}
          >
            <span className="truncate">{tab.label}</span>
            <span
              className={`text-xs transition-opacity cursor-pointer select-none ${
                isActive
                  ? "text-zinc-500 opacity-100 hover:text-zinc-300"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              ×
            </span>

            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
