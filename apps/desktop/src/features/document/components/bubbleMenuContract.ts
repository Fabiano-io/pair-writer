/**
 * Provisional UX contract for the evolved bubble menu (this cycle only).
 * This is NOT the definitive contract for future IA/context engine integration.
 * It exists to prepare the UX and allow a local handler to receive commands.
 * May be replaced or refactored when real integration is implemented.
 */

export type BubbleCommandType = "refine" | "simplify" | "formalize" | "custom";

export interface BubbleCommandPayload {
  type: BubbleCommandType;
  instruction: string;
  selectedText: string;
}

export type BubbleCommandHandler = (payload: BubbleCommandPayload) => void;
