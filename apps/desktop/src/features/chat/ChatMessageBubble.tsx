import type { ChatMessage } from "./chatTypes";
import { ChatThinkingBlock } from "./ChatThinkingBlock";
import { useTranslation } from "../settings/i18n/useTranslation";
import { ChatMarkdownContent } from "./ChatMarkdownContent";
import { FileIcon, ImageIcon } from "./ChatIcons";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessageBubble({ message, isStreaming = false }: ChatMessageBubbleProps) {
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
        className={`rounded-md px-3 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? "bg-[var(--app-surface-alt)]/72 text-[var(--app-text)]"
            : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]/90"
        }`}
      >
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-bg)]/35 px-2.5 py-1 text-[11px] text-[var(--app-text-muted)]"
              >
                {attachment.kind === "image" ? (
                  <ImageIcon className="h-3.5 w-3.5 text-amber-300" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 text-sky-300" />
                )}
                <span className="max-w-[220px] truncate">{attachment.name}</span>
              </span>
            ))}
          </div>
        )}

        {isUser ? (
          message.content ? (
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : null
        ) : (
          <>
            <ChatMarkdownContent content={message.content} />
            {isStreaming && (
              <span className="mt-1 inline-block h-[0.85em] w-[2px] animate-pulse rounded-sm bg-current opacity-50" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
