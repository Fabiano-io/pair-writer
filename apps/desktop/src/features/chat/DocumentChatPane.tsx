interface DocumentChatPaneProps {
  documentTitle: string;
}

const MOCK_MESSAGES = [
  {
    id: "1",
    role: "user" as const,
    content: "Can you help me refine the core principles section?",
  },
  {
    id: "2",
    role: "assistant" as const,
    content:
      "Of course! I notice the principles list mixes current features with future goals. Consider separating them into \"Active\" and \"Planned\" groups to give readers a clearer picture of where the product stands today.",
  },
  {
    id: "3",
    role: "user" as const,
    content: "Good idea. Can you draft that restructured version?",
  },
];

export function DocumentChatPane({ documentTitle }: DocumentChatPaneProps) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
      {/* Header with document link */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="text-xs text-zinc-600">💬</span>
        <h2 className="truncate text-xs font-medium text-zinc-400">
          Chat{" "}
          <span className="text-zinc-500">·</span>{" "}
          <span className="text-zinc-300">{documentTitle}</span>
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {MOCK_MESSAGES.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              {msg.role === "user" ? "You" : "Assistant"}
            </span>
            <div
              className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-zinc-800/60 text-zinc-200"
                  : "bg-zinc-800/30 text-zinc-300"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2.5">
          <input
            type="text"
            placeholder="Ask about this document..."
            disabled
            className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 outline-none disabled:cursor-default"
          />
          <button
            type="button"
            disabled
            className="shrink-0 text-sm text-zinc-600 transition-colors"
          >
            ↑
          </button>
        </div>
      </div>
    </aside>
  );
}
