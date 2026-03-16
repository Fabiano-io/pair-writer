import { useTranslation } from "../settings/i18n/useTranslation";
import type { ChatModelCatalogEntry } from "../settings/settingsDefaults";

interface ChatModelSelectorProps {
  models: ChatModelCatalogEntry[];
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
  className?: string;
}

export function ChatModelSelector({
  models,
  selectedModelId,
  onSelect,
  className = "",
}: ChatModelSelectorProps) {
  const { t } = useTranslation();

  if (models.length === 0) {
    return (
      <span className="truncate text-[11px] text-[var(--app-text-muted)]">
        {t("chat_no_models")}
      </span>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <select
        value={selectedModelId ?? models[0].id}
        onChange={(e) => onSelect(e.target.value)}
        className={`min-w-0 max-w-full truncate rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1 text-xs text-[var(--app-text)] outline-none transition-colors hover:border-[var(--app-text-muted)]/40 focus:border-[var(--app-text-muted)]/60 ${className}`}
        title={t("chat_model_select")}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
