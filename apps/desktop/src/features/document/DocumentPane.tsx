import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { DocumentEditorSurface } from "./components/DocumentEditorSurface";
import { EditorToolbar } from "./components/EditorToolbar";
import {
  APP_EDITOR_COPY_EVENT,
  APP_EDITOR_CUT_EVENT,
  APP_EDITOR_PASTE_EVENT,
  APP_EDITOR_REDO_EVENT,
  APP_EDITOR_UNDO_EVENT,
  dispatchEditorCopy,
  dispatchEditorCut,
  dispatchEditorPaste,
  dispatchEditorRedo,
  dispatchEditorUndo,
} from "./editorCommandEvents";
import {
  copyTextareaSelection,
  cutTextareaSelection,
  pasteIntoTextarea,
} from "./editorClipboard";

const PROVISIONAL_CONTENT = `Pair Writer is a desktop writing environment designed for structured thinking and AI-assisted content creation. It combines a focused document editor with contextual AI chat that lives alongside each document.

The core experience prioritizes rendered content over raw markup, delivering an editorial feel that keeps writers immersed in their ideas rather than formatting syntax.

[This is a transitional plain text area. The real TipTap rich-text engine will replace this space.]`;

function getScrollRatio(element: {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}): number {
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
  if (maxScroll <= 0) return 0;
  return element.scrollTop / maxScroll;
}

function applyScrollRatio(
  element: { scrollTop: number; scrollHeight: number; clientHeight: number },
  ratio: number
): void {
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = maxScroll * ratio;
}

interface DocumentPaneProps {
  title: string;
  /** When provided with onContentChange, enables controlled mode (e.g. per-tab content in workspace). */
  content?: string;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  isSaveable?: boolean;
  viewMode?: "rendered" | "source";
  isMarkdownDocument?: boolean;
  isPlainTextDocument?: boolean;
  showSourceLineNumbers?: boolean;
  onToggleMarkdownView?: () => void;
}

export function DocumentPane({
  title: initialTitle,
  content: controlledContent,
  onContentChange: onControlledContentChange,
  onSave,
  isSaveable = false,
  viewMode = "rendered",
  isMarkdownDocument = false,
  isPlainTextDocument = false,
  showSourceLineNumbers = false,
  onToggleMarkdownView,
}: DocumentPaneProps) {
  const [title, setTitle] = useState(initialTitle);
  const [localContent, setLocalContent] = useState(PROVISIONAL_CONTENT);
  const [sourceContent, setSourceContent] = useState("");

  const renderedScrollRef = useRef<HTMLElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sourceLineNumbersRef = useRef<HTMLPreElement | null>(null);
  const renderedScrollRatioRef = useRef(0);
  const sourceScrollRatioRef = useRef(0);
  const previousViewModeRef = useRef<"rendered" | "source">(viewMode);

  const isControlled =
    controlledContent !== undefined && onControlledContentChange !== undefined;
  const content = isControlled ? controlledContent : localContent;
  const setContent = isControlled ? onControlledContentChange : setLocalContent;

  const applySourceContent = useCallback(
    (value: string) => {
      setSourceContent(value);
      setContent(value);
    },
    [setContent]
  );

  const syncLineNumbersOffset = useCallback((scrollTop: number) => {
    if (!sourceLineNumbersRef.current) return;
    sourceLineNumbersRef.current.style.transform = `translateY(-${scrollTop}px)`;
  }, []);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (viewMode !== "source") return;
    if (!isMarkdownDocument && !isPlainTextDocument) return;
    setSourceContent((current) => (current === content ? current : content));
  }, [content, isMarkdownDocument, isPlainTextDocument, viewMode]);

  useLayoutEffect(() => {
    if (!isMarkdownDocument) {
      previousViewModeRef.current = viewMode;
      return;
    }

    const previousMode = previousViewModeRef.current;
    if (previousMode === viewMode) return;

    const ratio =
      previousMode === "rendered"
        ? renderedScrollRatioRef.current
        : sourceScrollRatioRef.current;

    previousViewModeRef.current = viewMode;

    requestAnimationFrame(() => {
      const targetElement =
        viewMode === "rendered"
          ? renderedScrollRef.current
          : sourceTextareaRef.current;
      if (!targetElement) return;
      applyScrollRatio(targetElement, ratio);

      if (viewMode === "rendered") {
        renderedScrollRatioRef.current = ratio;
      } else {
        sourceScrollRatioRef.current = ratio;
        if (sourceTextareaRef.current) {
          syncLineNumbersOffset(sourceTextareaRef.current.scrollTop);
        }
      }
    });
  }, [isMarkdownDocument, viewMode, syncLineNumbersOffset]);

  const handleRenderedScroll = useCallback((event: UIEvent<HTMLElement>) => {
    renderedScrollRatioRef.current = getScrollRatio(event.currentTarget);
  }, []);

  const handleSourceScroll = useCallback(
    (event: UIEvent<HTMLTextAreaElement>) => {
      sourceScrollRatioRef.current = getScrollRatio(event.currentTarget);
      syncLineNumbersOffset(event.currentTarget.scrollTop);
    },
    [syncLineNumbersOffset]
  );

  const showSourceMode =
    viewMode === "source" && (isMarkdownDocument || isPlainTextDocument);

  const shouldShowSourceLineNumbers =
    showSourceMode && showSourceLineNumbers && isPlainTextDocument;

  const sourceLineCount = useMemo(
    () => Math.max(1, sourceContent.split(/\r\n|\n|\r/).length),
    [sourceContent]
  );

  const sourceLineNumbers = useMemo(
    () =>
      Array.from({ length: sourceLineCount }, (_, index) => String(index + 1)).join(
        "\n"
      ),
    [sourceLineCount]
  );

  const sourceLineNumberDigits = useMemo(
    () => Math.max(2, String(sourceLineCount).length),
    [sourceLineCount]
  );

  const sourceLineGutterWidth = useMemo(
    () => 20 + sourceLineNumberDigits * 10,
    [sourceLineNumberDigits]
  );

  const handleSourceCut = useCallback(async () => {
    const textarea = sourceTextareaRef.current;
    if (!textarea) return;
    await cutTextareaSelection(textarea, applySourceContent);
  }, [applySourceContent]);

  const handleSourceCopy = useCallback(async () => {
    const textarea = sourceTextareaRef.current;
    if (!textarea) return;
    await copyTextareaSelection(textarea);
  }, []);

  const handleSourcePaste = useCallback(async () => {
    const textarea = sourceTextareaRef.current;
    if (!textarea) return;
    await pasteIntoTextarea(textarea, applySourceContent);
  }, [applySourceContent]);

  useEffect(() => {
    if (!showSourceMode) {
      syncLineNumbersOffset(0);
      return;
    }

    requestAnimationFrame(() => {
      if (!sourceTextareaRef.current) return;
      syncLineNumbersOffset(sourceTextareaRef.current.scrollTop);
    });
  }, [showSourceMode, syncLineNumbersOffset, sourceContent]);

  useEffect(() => {
    if (!showSourceMode) return;

    const applyTextCommand = (command: "undo" | "redo") => {
      const textarea = sourceTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      document.execCommand(command);
    };

    const handleUndo = () => applyTextCommand("undo");
    const handleRedo = () => applyTextCommand("redo");
    const handleCut = () => {
      void handleSourceCut();
    };
    const handleCopy = () => {
      void handleSourceCopy();
    };
    const handlePaste = () => {
      void handleSourcePaste();
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
  }, [showSourceMode, handleSourceCut, handleSourceCopy, handleSourcePaste]);

  const handleSourceChange = (value: string) => {
    applySourceContent(value);
  };

  return (
    <main className="app-document-area flex flex-1 flex-col overflow-hidden bg-[var(--app-bg)]/20">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden outline-none">
        <div className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col p-8 lg:p-10">
          {showSourceMode ? (
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              <div className="shrink-0">
                <EditorToolbar
                  editor={null}
                  onSave={onSave}
                  isSaveable={isSaveable}
                  canToggleMarkdownView={isMarkdownDocument || isPlainTextDocument}
                  markdownViewMode={viewMode}
                  onToggleMarkdownView={
                    isPlainTextDocument ? undefined : onToggleMarkdownView
                  }
                  onUndo={dispatchEditorUndo}
                  onRedo={dispatchEditorRedo}
                  onCut={dispatchEditorCut}
                  onCopy={dispatchEditorCopy}
                  onPaste={dispatchEditorPaste}
                  canUndo
                  canRedo
                  canCut
                  canCopy
                  canPaste
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-[var(--app-bg)]/20">
                {shouldShowSourceLineNumbers ? (
                  <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--app-border)]/40 bg-[var(--app-bg)]/10">
                    <div
                      className="relative shrink-0 overflow-hidden border-r border-[var(--app-border)]/40 bg-[var(--app-bg)]/30"
                      style={{
                        width: `${sourceLineGutterWidth}px`,
                        minWidth: `${sourceLineGutterWidth}px`,
                      }}
                    >
                      <pre
                        ref={sourceLineNumbersRef}
                        aria-hidden
                        className="pointer-events-none m-0 select-none px-2 py-4 text-right font-mono text-[14px] leading-[1.85] tabular-nums text-[var(--app-text-muted)]/80"
                      >
                        {sourceLineNumbers}
                      </pre>
                    </div>
                    <textarea
                      ref={sourceTextareaRef}
                      value={sourceContent}
                      onChange={(event) => handleSourceChange(event.target.value)}
                      onScroll={handleSourceScroll}
                      className="h-full min-h-[420px] w-full resize-none bg-transparent p-4 font-mono text-[14px] leading-[1.85] text-[var(--app-text)] outline-none"
                      spellCheck={false}
                      wrap="off"
                    />
                  </div>
                ) : (
                  <textarea
                    ref={sourceTextareaRef}
                    value={sourceContent}
                    onChange={(event) => handleSourceChange(event.target.value)}
                    onScroll={handleSourceScroll}
                    className="h-full min-h-[420px] w-full resize-none rounded-lg bg-transparent p-4 font-mono text-[14px] leading-[1.85] text-[var(--app-text)] outline-none"
                    spellCheck={false}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
              <DocumentEditorSurface
                title={title}
                content={content}
                onTitleChange={setTitle}
                onContentChange={setContent}
                onSave={onSave}
                isSaveable={isSaveable}
                canToggleMarkdownView={isMarkdownDocument}
                markdownViewMode={viewMode}
                onToggleMarkdownView={onToggleMarkdownView}
                scrollContainerRef={renderedScrollRef}
                onScrollContainer={handleRenderedScroll}
                contentType={isMarkdownDocument ? "markdown" : "html"}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
