import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type RefObject,
  type UIEvent,
} from "react";
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
  canToggleMarkdownView?: boolean;
  markdownViewMode?: "rendered" | "source";
  onToggleMarkdownView?: () => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  onScrollContainer?: (event: UIEvent<HTMLElement>) => void;
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
  canToggleMarkdownView = false,
  markdownViewMode = "rendered",
  onToggleMarkdownView,
  scrollContainerRef,
  onScrollContainer,
}: DocumentEditorSurfaceProps) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showCommandAck, setShowCommandAck] = useState(false);
  const commandAckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const handleEditorReady = useCallback((e: Editor) => setEditor(e), []);

  const handleBubbleCommand: BubbleCommandHandler = useCallback(() => {
    setShowCommandAck(true);
    if (commandAckTimeoutRef.current) {
      clearTimeout(commandAckTimeoutRef.current);
    }
    commandAckTimeoutRef.current = setTimeout(() => {
      setShowCommandAck(false);
      commandAckTimeoutRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (commandAckTimeoutRef.current) {
        clearTimeout(commandAckTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col outline-none">
      {!readOnly && (
        <div className="shrink-0">
          <EditorToolbar
            editor={editor}
            onSave={onSave}
            isSaveable={isSaveable}
            canToggleMarkdownView={canToggleMarkdownView}
            markdownViewMode={markdownViewMode}
            onToggleMarkdownView={onToggleMarkdownView}
          />
          {showCommandAck && (
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

      <article
        ref={scrollContainerRef}
        onScroll={onScrollContainer}
        className="min-h-0 flex-1 overflow-y-auto"
      >
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