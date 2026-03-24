import type { CanvasDiff } from "../chat/canvasTypes";

export const APP_EDITOR_UNDO_EVENT = "pair-writer:editor-undo";
export const APP_EDITOR_REDO_EVENT = "pair-writer:editor-redo";
export const APP_EDITOR_CUT_EVENT = "pair-writer:editor-cut";
export const APP_EDITOR_COPY_EVENT = "pair-writer:editor-copy";
export const APP_EDITOR_PASTE_EVENT = "pair-writer:editor-paste";
export const APP_EDITOR_CANVAS_APPLY_EVENT = "pair-writer:canvas-apply";

export interface CanvasApplyPayload {
  /** The document ID this edit targets (must match the open tab). */
  documentId: string;
  /** Full updated document content in markdown. Used as fallback. */
  newContent: string;
  /** Structured diff returned by the model. Null when model returned plain text. */
  canvasDiff: CanvasDiff | null;
  /** Tier A providers ("anchoring") use context anchoring first; others use DMP only. */
  anchorStrategy: "anchoring" | "dmp-only";
}

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

export function dispatchCanvasApply(payload: CanvasApplyPayload): void {
  window.dispatchEvent(
    new CustomEvent<CanvasApplyPayload>(APP_EDITOR_CANVAS_APPLY_EVENT, {
      detail: payload,
    })
  );
}
