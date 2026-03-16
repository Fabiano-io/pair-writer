import { useEffect, useRef } from "react";
import type { ChatMessage } from "./chatTypes";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { useTranslation } from "../settings/i18n/useTranslation";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {messages.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 text-xs text-[var(--app-text-muted)]">
          {t("chat_empty_state")}
        </div>
      )}

      {messages.map((msg) => (
        <ChatMessageBubble key={msg.id} message={msg} />
      ))}

      {isLoading && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium tracking-wide text-[var(--app-text-muted)] uppercase">
            {t("chat_assistant")}
          </span>
          <div className="rounded-md bg-[var(--app-surface-alt)]/30 px-3 py-2.5">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-text-muted)]" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-text-muted)]" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-text-muted)]" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
