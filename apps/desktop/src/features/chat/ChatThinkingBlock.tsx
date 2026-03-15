import { useTranslation } from "../settings/i18n/useTranslation";

interface ChatThinkingBlockProps {
  thinkingContent: string;
}

export function ChatThinkingBlock({ thinkingContent }: ChatThinkingBlockProps) {
  const { t } = useTranslation();

  return (
    <details className="mb-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-surface-alt)]/20">
      <summary className="flex cursor-pointer select-none items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]">
        <span className="opacity-70">💭</span>
        {t("chat_thinking")}
      </summary>
      <div className="border-t border-[var(--app-border)] px-2.5 py-2 text-xs leading-relaxed text-[var(--app-text-muted)] whitespace-pre-wrap">
        {thinkingContent}
      </div>
    </details>
  );
}
