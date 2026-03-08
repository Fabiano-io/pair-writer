const TABS = [
  { id: "product-vision", label: "Product Vision", active: true },
  { id: "context-engine", label: "Context Engine", active: false },
  { id: "checkpoints", label: "Checkpoints", active: false },
];

export function WorkspaceTabs() {
  return (
    <div className="flex shrink-0 items-end gap-0 border-b border-zinc-800 bg-zinc-950 px-2 pt-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`group relative flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm transition-colors ${
            tab.active
              ? "bg-zinc-900 text-zinc-100"
              : "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
          }`}
        >
          <span className="truncate">{tab.label}</span>
          <span
            className={`text-xs transition-opacity ${
              tab.active
                ? "text-zinc-500 opacity-100 hover:text-zinc-300"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            ×
          </span>

          {/* Active tab bottom highlight */}
          {tab.active && (
            <span className="absolute bottom-0 left-0 right-0 h-px bg-zinc-900" />
          )}
        </button>
      ))}
    </div>
  );
}
