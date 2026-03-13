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
import { useTranslation } from "../../settings/i18n/useTranslation";
import type { BubbleCommandHandler } from "./bubbleMenuContract";
import {
  APP_EDITOR_COPY_EVENT,
  APP_EDITOR_CUT_EVENT,
  APP_EDITOR_PASTE_EVENT,
  APP_EDITOR_REDO_EVENT,
  APP_EDITOR_UNDO_EVENT,
} from "../editorCommandEvents";
import {
  copyEditorSelection,
  cutEditorSelection,
  pasteIntoEditor,
} from "../editorClipboard";

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
  contentType?: "html" | "markdown";
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
  contentType = "html",
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

  useEffect(() => {
    if (!editor || readOnly) return;

    const handleUndo = () => {
      if (editor.can().undo()) {
        editor.chain().focus().undo().run();
      }
    };

    const handleRedo = () => {
      if (editor.can().redo()) {
        editor.chain().focus().redo().run();
      }
    };

    const handleCut = () => {
      void cutEditorSelection(editor);
    };

    const handleCopy = () => {
      void copyEditorSelection(editor);
    };

    const handlePaste = () => {
      void pasteIntoEditor(editor);
    };

    window.addEventListener(APP_EDITOR_UNDO_EVENT, handleUndo);
    window.addEventListener(APP_EDITOR_REDO_EVENT, handleRedo);
    window.addEventListener(APP_EDITOR_CUT_EVENT, handleCut);
    window.addEventListener(APP_EDITOR_COPY_EVENT, handleCopy);
    window.addEventListener(APP_EDITOR_PASTE_EVENT, handlePaste);

    return () => {
      window.removeEventListener(APP_EDITOR_UNDO_EVENT, handleUndo);
      window.removeEventListener(APP_EDITOR_REDO_EVENT, handleRedo);
      window.removeEventListener(APP_EDITOR_CUT_EVENT, handleCut);
      window.removeEventListener(APP_EDITOR_COPY_EVENT, handleCopy);
      window.removeEventListener(APP_EDITOR_PASTE_EVENT, handlePaste);
    };
  }, [editor, readOnly]);

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
          contentType={contentType}
        />
      </article>
    </div>
  );
}
