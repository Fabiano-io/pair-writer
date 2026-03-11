import { useTranslation } from "../features/settings/i18n/I18nContext";

interface UnsavedChangesDialogProps {
  documentName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  documentName,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="w-80 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-[var(--app-text)]">
          {t("unsaved_title")}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
          {t("unsaved_message")}{" "}
          <span className="font-medium text-[var(--app-text)]">{documentName}</span>?
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
          >
            {t("unsaved_cancel")}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded px-3 py-1.5 text-xs text-red-400/80 transition-colors hover:bg-[var(--app-surface-alt)] hover:text-red-300"
          >
            {t("unsaved_discard")}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            {t("menu_save")}
          </button>
        </div>
      </div>
    </div>
  );
}
