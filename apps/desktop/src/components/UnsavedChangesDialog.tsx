import { useCallback, useId, useRef } from "react";
import { useTranslation } from "../features/settings/i18n/useTranslation";
import { useDialogA11y } from "./useDialogA11y";

interface UnsavedChangesDialogProps {
  documentName?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  saveLabel?: string;
  details?: string[];
}

export function UnsavedChangesDialog({
  documentName,
  onSave,
  onDiscard,
  onCancel,
  title,
  message,
  saveLabel,
  details,
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => {
    onCancel();
  }, [onCancel]);
  const dialogRef = useDialogA11y({
    isOpen: true,
    onClose: handleClose,
    initialFocusRef: cancelButtonRef,
  });
  const resolvedTitle = title ?? t("unsaved_title");
  const resolvedMessage = message
    ? message
    : documentName
      ? `${t("unsaved_message")} ${documentName}?`
      : t("unsaved_message");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-80 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-sm font-semibold text-[var(--app-text)]">
          {resolvedTitle}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
          {resolvedMessage}
        </p>
        {details && details.length > 0 && (
          <div className="mt-3 max-h-32 overflow-y-auto rounded border border-[var(--app-border)]/70 bg-[var(--app-bg)]/25 px-3 py-2">
            {details.map((item) => (
              <div
                key={item}
                className="truncate text-xs leading-relaxed text-[var(--app-text-muted)]"
                title={item}
              >
                {item}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={handleClose}
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
            {saveLabel ?? t("menu_save")}
          </button>
        </div>
      </div>
    </div>
  );
}
