import { useEffect, useRef } from "react";
import type { ChatMessage } from "./chatTypes";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { useTranslation } from "../settings/i18n/useTranslation";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  documentId: string | null;
}

export function ChatMessageList({ messages, isLoading, documentId }: ChatMessageListProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastMsg = messages[messages.length - 1];
  const isStreamingAssistant = isLoading && lastMsg?.role === "assistant";
  const showDots = isLoading && !isStreamingAssistant;

  // True whenever we must jump to the bottom: initial mount and after every doc switch.
  // Set by the [documentId] effect; consumed by the [messages] effect once messages arrive.
  const pendingScrollToBottomRef = useRef(true);
  const prevDocIdRef = useRef(documentId);
  const prevMessagesLengthRef = useRef(messages.length);

  // When the document switches, mark that we need to scroll to the bottom.
  // This effect runs BEFORE the parent's effect that restores cached messages,
  // so the flag is already set when the [messages] effect fires in the next render.
  useEffect(() => {
    if (prevDocIdRef.current !== documentId) {
      prevDocIdRef.current = documentId;
      pendingScrollToBottomRef.current = true;
    }
  }, [documentId]);

  // Main scroll logic.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (pendingScrollToBottomRef.current) {
      // Wait until messages are actually populated for the new doc.
      if (messages.length > 0) {
        pendingScrollToBottomRef.current = false;
        prevMessagesLengthRef.current = messages.length;
        container.scrollTop = container.scrollHeight;
      }
      return;
    }

    // Same document — smooth-scroll to bottom only when a genuinely new message arrives
    // and the user is already near the bottom.
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    if (!isNewMessage) return;

    const distFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distFromBottom < 150) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Streaming: keep the view pinned to the bottom on each token unless the user
  // has intentionally scrolled up.
  useEffect(() => {
    if (!isStreamingAssistant) return;
    const container = containerRef.current;
    if (!container) return;
    const distFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distFromBottom < 200) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreamingAssistant]);

  return (
    <div
      ref={containerRef}
      className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
    >
      {messages.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 text-xs text-[var(--app-text-muted)]">
          {t("chat_empty_state")}
        </div>
      )}

      {messages.map((msg) => (
        <ChatMessageBubble
          key={msg.id}
          message={msg}
          isStreaming={isStreamingAssistant && msg.id === lastMsg.id}
        />
      ))}

      {showDots && (
        <div className="flex flex-col gap-1">
          <span className="text-[length:var(--ui-fs-sm)] font-medium tracking-wide text-[var(--app-text-muted)] uppercase">
            {t("chat_assistant")}
          </span>
          <div className="rounded-md bg-[var(--app-surface-alt)]/30 px-3 py-2.5">
            <span className="inline-flex gap-1">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-text-muted)]"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-text-muted)]"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--app-text-muted)]"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
