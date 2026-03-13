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
  const sourceScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
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
          : sourceScrollContainerRef.current;
      if (!targetElement) return;
      applyScrollRatio(targetElement, ratio);

      if (viewMode === "rendered") {
        renderedScrollRatioRef.current = ratio;
      } else {
        sourceScrollRatioRef.current = ratio;
      }
    });
  }, [isMarkdownDocument, viewMode]);

  const handleRenderedScroll = useCallback((event: UIEvent<HTMLElement>) => {
    renderedScrollRatioRef.current = getScrollRatio(event.currentTarget);
  }, []);

  const handleSourceScroll = useCallback((event: UIEvent<HTMLElement>) => {
    sourceScrollRatioRef.current = getScrollRatio(event.currentTarget);
  }, []);

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

  const resizeSourceTextarea = useCallback(() => {
    const textarea = sourceTextareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const minHeight = 560;
    const nextHeight = Math.max(minHeight, textarea.scrollHeight);
    textarea.style.height = `${nextHeight}px`;
  }, []);

  useLayoutEffect(() => {
    if (!showSourceMode) return;
    resizeSourceTextarea();
  }, [showSourceMode, sourceContent, shouldShowSourceLineNumbers, resizeSourceTextarea]);

  useEffect(() => {
    if (!showSourceMode) return;

    const handleResize = () => resizeSourceTextarea();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [showSourceMode, resizeSourceTextarea]);

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
        {showSourceMode ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative z-30 shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface)]">
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

            <div
              ref={sourceScrollContainerRef}
              onScroll={handleSourceScroll}
              className="min-h-0 flex-1 overflow-y-auto bg-[var(--app-bg)]/16 px-3 py-4 sm:px-4 sm:py-5"
            >
              <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col border border-[var(--app-border)] bg-[var(--app-surface)]">
                <div className="flex min-h-full flex-col bg-[var(--app-bg)]/10">
                  {shouldShowSourceLineNumbers ? (
                    <div className="flex min-h-[560px] border-y border-[var(--app-border)]/35 bg-transparent">
                      <div
                        className="relative shrink-0 overflow-hidden border-r border-[var(--app-border)]/40 bg-[var(--app-bg)]/25"
                        style={{
                          width: `${sourceLineGutterWidth}px`,
                          minWidth: `${sourceLineGutterWidth}px`,
                        }}
                      >
                        <pre
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
                        className="w-full min-h-[560px] resize-none overflow-y-hidden bg-transparent p-6 font-mono text-[14px] leading-[1.85] text-[var(--app-text)] outline-none sm:p-8"
                        spellCheck={false}
                        wrap="off"
                      />
                    </div>
                  ) : (
                    <textarea
                      ref={sourceTextareaRef}
                      value={sourceContent}
                      onChange={(event) => handleSourceChange(event.target.value)}
                      className="w-full min-h-[560px] resize-none overflow-y-hidden bg-transparent p-6 font-mono text-[14px] leading-[1.85] text-[var(--app-text)] outline-none sm:p-8"
                      spellCheck={false}
                    />
                  )}
                </div>
                <div
                  aria-hidden
                  className="h-14 shrink-0 border-t border-[var(--app-border)]/70 bg-[var(--app-surface)]"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
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
    </main>
  );
}
