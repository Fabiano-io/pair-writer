interface ExplorerSidebarProps {
  width: number;
}

const EXPLORER_GROUPS = [
  {
    label: "Project",
    items: [
      { name: "Product Vision.md", active: true },
      { name: "Context Engine.md", active: false },
      { name: "Checkpoints.md", active: false },
    ],
  },
  {
    label: "Global",
    items: [
      { name: "Patterns.md", active: false },
      { name: "References.md", active: false },
    ],
  },
];

export function ExplorerSidebar({ width }: ExplorerSidebarProps) {
  return (
    <aside
      className="flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="text-base">✦</span>
        <span className="text-sm font-semibold tracking-wide text-zinc-200">
          Pair Writer
        </span>
      </div>

      {/* Tree */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {EXPLORER_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <h3 className="mb-1 px-2 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
              {group.label}
            </h3>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      item.active
                        ? "bg-zinc-800/70 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                    }`}
                  >
                    <span className="text-xs opacity-60">📄</span>
                    <span className="truncate">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
