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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="w-80 rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-zinc-100">
          Unsaved Changes
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Do you want to save changes to{" "}
          <span className="font-medium text-zinc-300">{documentName}</span>?
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded px-3 py-1.5 text-xs text-red-400/80 transition-colors hover:bg-zinc-800 hover:text-red-300"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-colors hover:bg-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
