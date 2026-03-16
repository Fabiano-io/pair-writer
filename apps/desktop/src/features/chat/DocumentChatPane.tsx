import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useChatConversation } from "./useChatConversation";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { useTranslation } from "../settings/i18n/useTranslation";

interface DocumentChatPaneProps {
  documentId: string | null;
  documentTitle: string;
  width: number;
  configVersion: number;
  onResize: (delta: number) => void;
  onResizeEnd: () => void;
  onOpenAISettings: () => void;
}

export function DocumentChatPane({
  documentId,
  documentTitle,
  width,
  configVersion,
  onResize,
  onResizeEnd,
  onOpenAISettings,
}: DocumentChatPaneProps) {
  const { t } = useTranslation();
  const startXRef = useRef(0);

  const handleTopEdgeMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      startXRef.current = event.clientX;
      document.body.classList.add("resize-dragging");

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        startXRef.current = moveEvent.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.classList.remove("resize-dragging");
        onResizeEnd();
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize, onResizeEnd]
  );

  const {
    messages,
    isLoading,
    error,
    models,
    selectedModel,
    selectedModelId,
    setSelectedModelId,
    composerText,
    setComposerText,
    mode,
    setMode,
    attachments,
    setAttachments,
    composerError,
    setComposerError,
    sendMessage,
    clearConversation,
    dismissError,
  } = useChatConversation({ configVersion, documentId });

  return (
    <aside
      className="flex shrink-0 flex-col border-l border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]"
      style={{ width }}
    >
      <div
        className="group flex h-2 cursor-col-resize items-center justify-center border-b border-[var(--app-border)]/70"
        onMouseDown={handleTopEdgeMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
      >
        <span className="h-[2px] w-10 rounded-full bg-[var(--app-text-muted)]/20 transition-colors group-hover:bg-[var(--app-text-muted)]/45" />
      </div>

      {/* Header */}
      <div className="border-b border-[var(--app-border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] text-[11px] font-medium text-[var(--app-text-muted)]">
            C
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[13px] font-medium text-[var(--app-text)]">
              {t("chat_title")}
            </h2>
            <p className="truncate text-[11px] text-[var(--app-text-muted)]">
              {documentTitle}
              {selectedModel ? ` · ${selectedModel.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearConversation}
                className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 text-xs text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
                title={t("chat_clear")}
              >
                {t("chat_clear")}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAISettings}
              className="inline-flex h-7 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 text-xs font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
            >
              {t("chat_open_ai_settings")}
            </button>
          </div>
        </div>
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

      <ChatInput
        onSend={sendMessage}
        isLoading={isLoading}
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
        composerText={composerText}
        onComposerTextChange={setComposerText}
        mode={mode}
        onModeChange={setMode}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        composerError={composerError}
        onComposerErrorChange={setComposerError}
      />
    </aside>
  );
}
