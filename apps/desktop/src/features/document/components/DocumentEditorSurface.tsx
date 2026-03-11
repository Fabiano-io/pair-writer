import { useState, useCallback, useEffect } from "react";
import { type Editor } from "@tiptap/react";
import { TipTapEditor } from "./TipTapEditor";
import { EditorToolbar } from "./EditorToolbar";
import { useTranslation } from "../../settings/i18n/I18nContext";
import type { BubbleCommandHandler } from "./bubbleMenuContract";

interface DocumentEditorSurfaceProps {
  title?: string;
  content?: string;
  onTitleChange?: (title: string) => void;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  isSaveable?: boolean;
  readOnly?: boolean;
}

/**
 * Provisional UX: header (title + meta) hidden to reduce ambiguity.
 * Props title/onTitleChange retained for possible future reintroduction.
 */
export function DocumentEditorSurface({
  content,
  onContentChange,
  onSave,
  isSaveable = false,
  readOnly = false,
}: DocumentEditorSurfaceProps) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [commandAckUntil, setCommandAckUntil] = useState<number>(0);
  const handleEditorReady = useCallback((e: Editor) => setEditor(e), []);

  const handleBubbleCommand: BubbleCommandHandler = useCallback((_payload) => {
    setCommandAckUntil(Date.now() + 2000);
  }, []);

  useEffect(() => {
    if (commandAckUntil <= 0) return;
    const duration = Math.max(0, commandAckUntil - Date.now());
    const id = setTimeout(() => setCommandAckUntil(0), duration);
    return () => clearTimeout(id);
  }, [commandAckUntil]);

  return (
    <div className="flex min-h-0 flex-1 flex-col outline-none">
      {!readOnly && (
        <div className="shrink-0">
          <EditorToolbar
            editor={editor}
            onSave={onSave}
            isSaveable={isSaveable}
          />
          {commandAckUntil > Date.now() && (
            <div
              role="status"
              aria-live="polite"
              className="mt-2 px-3 py-1.5 text-xs text-zinc-500 bg-zinc-800/60 rounded-md w-fit"
            >
              {t("bubble_command_prepared")}
            </div>
          )}
        </div>
      )}

      <article className="min-h-0 flex-1 overflow-y-auto">
        <TipTapEditor
          content={content}
          onContentChange={onContentChange}
          onEditorReady={handleEditorReady}
          onBubbleCommand={handleBubbleCommand}
          readOnly={readOnly}
        />
      </article>
    </div>
  );
}
