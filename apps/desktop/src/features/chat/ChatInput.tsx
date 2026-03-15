import { useCallback, useRef, useState, useEffect } from "react";
import { useTranslation } from "../settings/i18n/useTranslation";

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Clamp between 1 row (~24px) and ~4 rows (~96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
  }, [value, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t border-[var(--app-border)] p-3">
      <div className="flex items-end gap-2 rounded-lg bg-[var(--app-surface-alt)]/50 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat_placeholder")}
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-[var(--app-text)]/90 placeholder-[var(--app-text-muted)]/60 outline-none disabled:cursor-default"
          style={{ maxHeight: "96px" }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isLoading || !value.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-30 bg-[var(--app-text-muted)]/10 hover:bg-[var(--app-text-muted)]/20 text-[var(--app-text)]"
          title={t("chat_send")}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
