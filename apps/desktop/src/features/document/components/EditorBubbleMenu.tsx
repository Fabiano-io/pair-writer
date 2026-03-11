import { useState, useRef, useCallback } from "react";
import { type Editor } from "@tiptap/react";
import { useTranslation } from "../../settings/i18n/useTranslation";
import type { BubbleCommandPayload, BubbleCommandHandler } from "./bubbleMenuContract";

interface EditorBubbleMenuProps {
  editor: Editor;
  onBubbleCommand?: BubbleCommandHandler;
}

function BubbleMenuButton({
  isActive,
  onClick,
  children,
  title,
  variant = "default",
}: {
  isActive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  variant?: "default" | "ai";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1.5 text-xs font-semibold rounded transition-colors ${
        variant === "ai"
          ? "text-cyan-500 hover:bg-[var(--app-surface-alt)]/70 hover:text-cyan-400"
          : isActive
            ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] shadow-sm"
            : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-alt)]/70 hover:text-[var(--app-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function BubbleMenuDivider() {
  return <div className="mx-1 h-4 w-px bg-[var(--app-border)]" />;
}

function RefineIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

const AI_PRESETS = [
  { type: "refine" as const, instructionKey: "Refine this", labelKey: "bubble_refine" },
  { type: "simplify" as const, instructionKey: "Simplify this", labelKey: "bubble_simplify" },
  { type: "formalize" as const, instructionKey: "Make this more formal", labelKey: "bubble_formalize" },
] as const;

/**
 * Evolved contextual bubble menu over text selection.
 * Quick formatting actions, AI preset buttons (UX-only this cycle), and free instruction field.
 */
export function EditorBubbleMenu({ editor, onBubbleCommand }: EditorBubbleMenuProps) {
  const { t } = useTranslation();
  const [instruction, setInstruction] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sent">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSelectedText = useCallback(() => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ");
  }, [editor]);

  const handleSend = useCallback(() => {
    const trimmed = instruction.trim();
    if (!trimmed) return;

    const selectedText = getSelectedText();
    const payload: BubbleCommandPayload = {
      type: "custom",
      instruction: trimmed,
      selectedText,
    };
    onBubbleCommand?.(payload);

    setInstruction("");
    setSendState("sent");
    if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    sendTimeoutRef.current = setTimeout(() => {
      sendTimeoutRef.current = null;
      setSendState("idle");
      editor.chain().focus().setTextSelection(editor.state.selection.to).run();
    }, 350);
  }, [instruction, editor, getSelectedText, onBubbleCommand]);

  const handlePresetClick = useCallback((suggestedInstruction: string) => {
    setInstruction(suggestedInstruction);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="editor-bubble-menu flex min-w-[280px] max-w-[420px] select-none flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)]/95 p-2 shadow-lg">
      <div className="flex items-center gap-1 flex-wrap">
        <BubbleMenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title={t("bubble_bold")}
        >
          B
        </BubbleMenuButton>
        <BubbleMenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title={t("bubble_italic")}
        >
          I
        </BubbleMenuButton>
        <BubbleMenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title={t("bubble_h2")}
        >
          H2
        </BubbleMenuButton>
        <BubbleMenuButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          title={t("bubble_code")}
        >
          {"<>"}
        </BubbleMenuButton>

        <BubbleMenuDivider />

        {AI_PRESETS.map(({ type, instructionKey, labelKey }) => (
          <BubbleMenuButton
            key={type}
            variant="ai"
            onClick={() => handlePresetClick(instructionKey)}
            title={t(labelKey)}
          >
            <span className="flex items-center gap-1">
              <RefineIcon />
              {t(labelKey)}
            </span>
          </BubbleMenuButton>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("bubble_instruction_placeholder")}
          className="flex-1 min-w-0 rounded border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-1.5 text-xs text-[var(--app-text)] placeholder-[var(--app-text-muted)] focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!instruction.trim()}
          className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            sendState === "sent"
              ? "bg-emerald-600/80 text-white"
              : instruction.trim()
                ? "bg-cyan-600/80 text-white hover:bg-cyan-500/80"
                : "cursor-not-allowed bg-[var(--app-surface-alt)] text-[var(--app-text-muted)]"
          }`}
        >
          {sendState === "sent" ? "✓" : t("bubble_send")}
        </button>
      </div>
    </div>
  );
}
