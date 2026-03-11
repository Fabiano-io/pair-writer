import { useTranslation } from "../settings/i18n/useTranslation";

interface DocumentChatPaneProps {
  documentTitle: string;
  width: number;
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
      'Of course! I notice the principles list mixes current features with future goals. Consider separating them into "Active" and "Planned" groups to give readers a clearer picture of where the product stands today.',
  },
  {
    id: "3",
    role: "user" as const,
    content: "Good idea. Can you draft that restructured version?",
  },
];

export function DocumentChatPane({
  documentTitle,
  width,
}: DocumentChatPaneProps) {
  const { t } = useTranslation();
  return (
    <aside
      className="flex shrink-0 flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)]"
      style={{ width }}
    >
      {/* Header with document link */}
      <div className="flex items-center gap-2 border-b border-[var(--app-border)] px-4 py-3">
        <span className="text-xs text-[var(--app-text-muted)]">💬</span>
        <h2 className="truncate text-xs font-medium text-[var(--app-text-muted)]">
          {t("chat_title")}{" "}
          <span className="text-[var(--app-text-muted)]/80">·</span>{" "}
          <span className="text-[var(--app-text)]/90">{documentTitle}</span>
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {MOCK_MESSAGES.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium tracking-wide text-[var(--app-text-muted)] uppercase">
              {msg.role === "user" ? t("chat_you") : t("chat_assistant")}
            </span>
            <div
              className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--app-surface-alt)]/60 text-[var(--app-text)]"
                  : "bg-[var(--app-surface-alt)]/30 text-[var(--app-text)]/90"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--app-border)] p-3">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--app-surface-alt)]/50 px-3 py-2.5">
          <input
            type="text"
            placeholder={t("chat_placeholder")}
            disabled
            className="flex-1 bg-transparent text-sm text-[var(--app-text)]/90 placeholder-[var(--app-text-muted)]/60 outline-none disabled:cursor-default"
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
