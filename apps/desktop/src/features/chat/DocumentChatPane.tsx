import { useEffect, useState } from "react";
import { hasApiKey } from "./chatCredentials";
import { loadChatSettings } from "./chatSettings";
import { useTranslation } from "../settings/i18n/useTranslation";
import type { ChatProvider, ChatSettings } from "../settings/settingsDefaults";

interface DocumentChatPaneProps {
  documentTitle: string;
  width: number;
  configVersion: number;
  onOpenAISettings: () => void;
}

const PROVIDER_LABELS: Record<ChatProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  lmStudio: "LM Studio",
  openAiCompatible: "OpenAI-Compatible",
};

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
  configVersion,
  onOpenAISettings,
}: DocumentChatPaneProps) {
  const { t } = useTranslation();
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadChatSettings()
      .then(async (settings) => {
        if (cancelled) return;
        setChatSettings(settings);

        if (
          settings.provider === "lmStudio" ||
          settings.provider === "openAiCompatible"
        ) {
          setHasCredential(null);
          return;
        }

        const stored = await hasApiKey(settings.provider);
        if (!cancelled) {
          setHasCredential(stored);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChatSettings(null);
          setHasCredential(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [configVersion]);

  const activeProvider = chatSettings?.provider ?? "lmStudio";
  const providerLabel =
    activeProvider === "openAiCompatible"
      ? chatSettings?.openAiCompatible.displayName || PROVIDER_LABELS[activeProvider]
      : PROVIDER_LABELS[activeProvider];
  const providerDetail =
    activeProvider === "lmStudio"
      ? chatSettings?.lmStudio.endpointUrl
      : activeProvider === "openAiCompatible"
        ? chatSettings?.openAiCompatible.endpointUrl
      : hasCredential === null
        ? t("chat_status_checking")
        : hasCredential
          ? t("chat_status_key_saved")
          : t("chat_status_key_missing");

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

      <div className="border-b border-[var(--app-border)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium tracking-wide text-[var(--app-text-muted)] uppercase">
              {t("chat_provider_label")}
            </p>
            <p className="truncate text-sm text-[var(--app-text)]">
              {providerLabel}
            </p>
          </div>
          <span className="rounded-full bg-[var(--app-surface-alt)] px-2 py-1 text-[10px] text-[var(--app-text-muted)]">
            {activeProvider === "lmStudio"
              ? t("chat_provider_local")
              : activeProvider === "openAiCompatible"
                ? t("chat_provider_endpoint")
              : t("chat_provider_cloud")}
          </span>
        </div>
        <p className="mt-2 truncate text-[11px] text-[var(--app-text-muted)]">
          {providerDetail}
        </p>
        <button
          type="button"
          onClick={onOpenAISettings}
          className="mt-3 rounded-md border border-[var(--app-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
        >
          {t("chat_open_ai_settings")}
        </button>
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
