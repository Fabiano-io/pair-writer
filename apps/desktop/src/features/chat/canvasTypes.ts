import type { CanvasIntent } from "./canvasIntentClassifier";

export interface CanvasChange {
  original: string;
  corrected: string;
  reason: string;
  context: {
    before: string;
    after: string;
  };
  occurrences: number[] | "all";
}

export interface CanvasDiff {
  summary: string;
  correctedDocument: string;
  changes: CanvasChange[];
  intent: CanvasIntent;
}
