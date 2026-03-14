import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
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
  documentId?: string | null;
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
  documentId = null,
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
  const [localContent, setLocalContent] = useState("");
  const [sourceContent, setSourceContent] = useState("");

  const renderedScrollRef = useRef<HTMLElement | null>(null);
  const sourceScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const renderedScrollRatioRef = useRef(0);
  const sourceScrollRatioRef = useRef(0);
  const previousViewModeRef = useRef<"rendered" | "source">(viewMode);
  const sourceInitialFocusPendingRef = useRef(false);
  const sourceFocusRafRef = useRef<number | null>(null);

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

  const focusSourceAtStart = useCallback(() => {
    if (sourceFocusRafRef.current !== null) {
      window.cancelAnimationFrame(sourceFocusRafRef.current);
      sourceFocusRafRef.current = null;
    }

    sourceFocusRafRef.current = window.requestAnimationFrame(() => {
      const textarea = sourceTextareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(0, 0);
      textarea.scrollTop = 0;
      sourceScrollContainerRef.current?.scrollTo({ top: 0 });
      sourceFocusRafRef.current = null;
    });
  }, []);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (viewMode !== "source") return;
    if (!isMarkdownDocument && !isPlainTextDocument) return;

    const nextContent = content ?? "";
    setSourceContent((current) => {
      if (current === nextContent) return current;

      if (sourceInitialFocusPendingRef.current) {
        focusSourceAtStart();

        // Keep pending when transitioning through temporary empty content.
        // This guarantees focus is also applied when the real file content arrives.
        if (nextContent.length > 0) {
          sourceInitialFocusPendingRef.current = false;
        }
      }

      return nextContent;
    });
  }, [content, isMarkdownDocument, isPlainTextDocument, viewMode, focusSourceAtStart]);

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

  const scrollSourceContainerToBoundary = useCallback(
    (boundary: "start" | "end") => {
      const container = sourceScrollContainerRef.current;
      if (!container) return;

      if (boundary === "start") {
        container.scrollTo({ top: 0 });
        return;
      }

      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTo({ top: maxScroll });
    },
    []
  );

  const handleSourceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const hasBoundaryModifier = event.ctrlKey || event.metaKey;
      if (!hasBoundaryModifier || event.altKey) return;

      if (event.key !== "Home" && event.key !== "End") return;

      event.preventDefault();
      sourceInitialFocusPendingRef.current = false;

      const textarea = event.currentTarget;
      const isHome = event.key === "Home";
      const caretPosition = isHome ? 0 : textarea.value.length;

      textarea.focus();
      textarea.setSelectionRange(caretPosition, caretPosition);

      window.requestAnimationFrame(() => {
        scrollSourceContainerToBoundary(isHome ? "start" : "end");
      });
    },
    [scrollSourceContainerToBoundary]
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

  useEffect(() => {
    if (!showSourceMode) {
      sourceInitialFocusPendingRef.current = false;
      return;
    }

    sourceInitialFocusPendingRef.current = true;
    focusSourceAtStart();
  }, [showSourceMode, documentId, focusSourceAtStart]);

  useEffect(() => {
    return () => {
      if (sourceFocusRafRef.current !== null) {
        window.cancelAnimationFrame(sourceFocusRafRef.current);
      }
    };
  }, []);

  const handleSourceChange = (value: string) => {
    sourceInitialFocusPendingRef.current = false;
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
                        onKeyDown={handleSourceKeyDown}
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
                      onKeyDown={handleSourceKeyDown}
                      className="w-full min-h-[560px] resize-none overflow-y-hidden bg-transparent p-6 font-mono text-[14px] leading-[1.85] text-[var(--app-text)] outline-none sm:p-8"
                      spellCheck={false}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <DocumentEditorSurface
              documentId={documentId}
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
