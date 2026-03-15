import type { ChatMessage } from "./chatTypes";
import { ChatThinkingBlock } from "./ChatThinkingBlock";
import { useTranslation } from "../settings/i18n/useTranslation";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wide text-[var(--app-text-muted)] uppercase">
        {isUser ? t("chat_you") : t("chat_assistant")}
      </span>

      {!isUser && message.thinkingContent && (
        <ChatThinkingBlock thinkingContent={message.thinkingContent} />
      )}

      <div
        className={`rounded-lg px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[var(--app-surface-alt)]/60 text-[var(--app-text)]"
            : "bg-[var(--app-surface-alt)]/30 text-[var(--app-text)]/90"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
