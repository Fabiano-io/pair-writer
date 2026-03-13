export const APP_EDITOR_UNDO_EVENT = "pair-writer:editor-undo";
export const APP_EDITOR_REDO_EVENT = "pair-writer:editor-redo";
export const APP_EDITOR_CUT_EVENT = "pair-writer:editor-cut";
export const APP_EDITOR_COPY_EVENT = "pair-writer:editor-copy";
export const APP_EDITOR_PASTE_EVENT = "pair-writer:editor-paste";

export function dispatchEditorUndo(): void {
  window.dispatchEvent(new Event(APP_EDITOR_UNDO_EVENT));
}

export function dispatchEditorRedo(): void {
  window.dispatchEvent(new Event(APP_EDITOR_REDO_EVENT));
}

export function dispatchEditorCut(): void {
  window.dispatchEvent(new Event(APP_EDITOR_CUT_EVENT));
}

export function dispatchEditorCopy(): void {
  window.dispatchEvent(new Event(APP_EDITOR_COPY_EVENT));
}

export function dispatchEditorPaste(): void {
  window.dispatchEvent(new Event(APP_EDITOR_PASTE_EVENT));
}
