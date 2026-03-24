import type { CanvasDiff } from "./canvasTypes";

export function parseCanvasDiff(raw: string): CanvasDiff {
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(clean);

  if (!Array.isArray(parsed.changes)) {
    throw new Error('Canvas payload inválido: campo "changes" ausente');
  }
  if (typeof parsed.correctedDocument !== "string") {
    throw new Error('Canvas payload inválido: campo "correctedDocument" ausente');
  }

  return parsed as CanvasDiff;
}
