import { useState } from "react";

export interface WorkspaceTab {
  id: string;
  label: string;
}

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  dirtyTabIds: Set<string>;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
}

export function WorkspaceTabs({
  tabs,
  activeTabId,
  dirtyTabIds,
  onTabSelect,
  onTabClose,
}: WorkspaceTabsProps) {
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 items-end gap-0 border-b border-[var(--app-border)] bg-[var(--app-bg)] px-2 pt-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isDirty = dirtyTabIds.has(tab.id);
        const isHovered = hoveredTabId === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabSelect(tab.id)}
            onMouseEnter={() => setHoveredTabId(tab.id)}
            onMouseLeave={() => setHoveredTabId(null)}
            className={`group relative flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm transition-colors ${
              isActive
                ? "bg-[var(--app-surface)] text-[var(--app-text)] font-medium"
                : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]/50 hover:text-[var(--app-text)]/80"
            }`}
          >
            <span className="truncate">{tab.label}</span>
            <span
              className={`flex h-4 w-4 items-center justify-center text-xs transition-opacity cursor-pointer select-none ${
                isActive
                  ? "text-[var(--app-text-muted)] opacity-100 hover:text-[var(--app-text)]/80"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              {isDirty && !isHovered ? (
                <span className="h-2 w-2 rounded-full bg-zinc-400" />
              ) : (
                "×"
              )}
            </span>

            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-[var(--app-surface)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
