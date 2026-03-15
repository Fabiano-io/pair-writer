import { useChatConversation } from "./useChatConversation";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { ChatModelSelector } from "./ChatModelSelector";
import { useTranslation } from "../settings/i18n/useTranslation";

interface DocumentChatPaneProps {
  documentTitle: string;
  width: number;
  configVersion: number;
  onOpenAISettings: () => void;
}

export function DocumentChatPane({
  documentTitle,
  width,
  configVersion,
  onOpenAISettings,
}: DocumentChatPaneProps) {
  const { t } = useTranslation();

  const {
    messages,
    isLoading,
    error,
    models,
    selectedModelId,
    setSelectedModelId,
    sendMessage,
    clearConversation,
    dismissError,
  } = useChatConversation({ configVersion });

  return (
    <aside
      className="flex shrink-0 flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)]"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--app-border)] px-4 py-3">
        <span className="text-xs text-[var(--app-text-muted)]">💬</span>
        <h2 className="truncate text-xs font-medium text-[var(--app-text-muted)]">
          {t("chat_title")}{" "}
          <span className="text-[var(--app-text-muted)]/80">·</span>{" "}
          <span className="text-[var(--app-text)]/90">{documentTitle}</span>
        </h2>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearConversation}
            className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
            title={t("chat_clear")}
          >
            {t("chat_clear")}
          </button>
        )}
      </div>

      {/* Model selector + settings */}
      <div className="flex items-center gap-2 border-b border-[var(--app-border)] px-4 py-2.5">
        <ChatModelSelector
          models={models}
          selectedModelId={selectedModelId}
          onSelect={setSelectedModelId}
        />
        <button
          type="button"
          onClick={onOpenAISettings}
          className="ml-auto shrink-0 rounded-md border border-[var(--app-border)] px-2 py-1 text-[10px] font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
        >
          {t("chat_open_ai_settings")}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 border-b border-red-500/20 bg-red-500/10 px-4 py-2.5">
          <p className="flex-1 text-xs leading-relaxed text-red-400">
            {error}
          </p>
          <button
            type="button"
            onClick={dismissError}
            className="shrink-0 text-xs text-red-400/70 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      )}

      {/* Messages */}
      <ChatMessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </aside>
  );
}
