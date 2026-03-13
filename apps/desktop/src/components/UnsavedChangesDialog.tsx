import { useCallback, useId, useRef } from "react";
import { useTranslation } from "../features/settings/i18n/useTranslation";
import { useDialogA11y } from "./useDialogA11y";

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
          {t("unsaved_title")}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
          {t("unsaved_message")}{" "}
          <span className="font-medium text-[var(--app-text)]">{documentName}</span>?
        </p>

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
            {t("menu_save")}
          </button>
        </div>
      </div>
    </div>
  );
}
