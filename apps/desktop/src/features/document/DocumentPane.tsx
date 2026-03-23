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
import { DocxDocumentView } from "./components/DocxDocumentView";
import { EditorToolbar } from "./components/EditorToolbar";
import { PdfDocumentView } from "./components/PdfDocumentView";
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
import { useTranslation } from "../settings/i18n/useTranslation";
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

function resolveLineHeightPx(styles: CSSStyleDeclaration): number {
  const rawLineHeight = styles.lineHeight ?? "";
  const fontSize = Number.parseFloat(styles.fontSize || "16") || 16;

  if (!rawLineHeight || rawLineHeight === "normal") {
    return Math.max(1, fontSize * 1.5);
  }

  if (rawLineHeight.endsWith("px")) {
    const value = Number.parseFloat(rawLineHeight);
    if (Number.isFinite(value) && value > 0) return value;
  }

  const unitlessValue = Number.parseFloat(rawLineHeight);
  if (Number.isFinite(unitlessValue) && unitlessValue > 0) {
    return unitlessValue * fontSize;
  }

  return Math.max(1, fontSize * 1.5);
}

interface DocumentPaneProps {
  documentId?: string | null;
  chatConfigVersion?: number;
  documentPath?: string | null;
  title: string;
  /** When provided with onContentChange, enables controlled mode (e.g. per-tab content in workspace). */
  content?: string;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  isSaveable?: boolean;
  viewMode?: "rendered" | "source";
  isMarkdownDocument?: boolean;
  isPlainTextDocument?: boolean;
  isPdfDocument?: boolean;
  isDocxDocument?: boolean;
  showSourceLineNumbers?: boolean;
  onToggleMarkdownView?: () => void;
}

export function DocumentPane({
  documentId = null,
  chatConfigVersion = 0,
  documentPath = null,
  title: initialTitle,
  content: controlledContent,
  onContentChange: onControlledContentChange,
  onSave,
  isSaveable = false,
  viewMode = "rendered",
  isMarkdownDocument = false,
  isPlainTextDocument = false,
  isPdfDocument = false,
  isDocxDocument = false,
  showSourceLineNumbers = false,
  onToggleMarkdownView,
}: DocumentPaneProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [localContent, setLocalContent] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceDisplayLineCount, setSourceDisplayLineCount] = useState(1);

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

  // --- Source Mode History (Undo/Redo) ---
  const sourceUndoStackRef = useRef<string[]>([]);
  const sourceRedoStackRef = useRef<string[]>([]);
  const hasSourceUndoState = sourceUndoStackRef.current.length > 0;
  const hasSourceRedoState = sourceRedoStackRef.current.length > 0;
  // Force re-render just for toolbar buttons state when history changes
  const [, forceUpdateHistory] = useState(0);

  const applySourceContentWithHistory = useCallback(
    (next: string, shouldPushToUndo = true) => {
      const current = sourceTextareaRef.current?.value || "";
      if (shouldPushToUndo && current !== next) {
        sourceUndoStackRef.current.push(current);
        sourceRedoStackRef.current = []; // clear redo on new change
        forceUpdateHistory((v) => v + 1);
      }
      applySourceContent(next);
    },
    [applySourceContent]
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

    const rafIds: number[] = [];
    let timeoutId: number | null = null;
    let cancelled = false;

    const applyToTarget = () => {
      if (cancelled) return;

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
    };

    // Re-apply across a few frames because rendered mode may settle asynchronously.
    const scheduleFrames = (remaining: number) => {
      const rafId = window.requestAnimationFrame(() => {
        applyToTarget();
        if (remaining > 1) {
          scheduleFrames(remaining - 1);
        }
      });
      rafIds.push(rafId);
    };

    scheduleFrames(4);
    timeoutId = window.setTimeout(() => {
      applyToTarget();
    }, 120);

    return () => {
      cancelled = true;
      for (const rafId of rafIds) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
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

  // --- Source Formatting Helpers ---
  const applySourceFormatting = useCallback((prefix: string, suffix: string = prefix, defaultText = "text") => {
    const textarea = sourceTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selectedText = currentText.substring(start, end);
    
    // If we're toggling formatting off (naive check)
    const isAlreadyFormatted = 
      start >= prefix.length && 
      end <= currentText.length - suffix.length &&
      currentText.substring(start - prefix.length, start) === prefix &&
      currentText.substring(end, end + suffix.length) === suffix;

    let nextValue;
    let nextStart;
    let nextEnd;

    if (isAlreadyFormatted) {
      // Remove formatting
      nextValue = currentText.substring(0, start - prefix.length) + selectedText + currentText.substring(end + suffix.length);
      nextStart = start - prefix.length;
      nextEnd = nextStart + selectedText.length;
    } else {
      // Add formatting
      const textToInsert = selectedText || defaultText;
      nextValue = currentText.substring(0, start) + prefix + textToInsert + suffix + currentText.substring(end);
      nextStart = start + prefix.length;
      nextEnd = nextStart + textToInsert.length;
    }

    applySourceContentWithHistory(nextValue);
    
    // Restore selection
    window.requestAnimationFrame(() => {
      const el = sourceTextareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextStart, nextEnd);
    });
  }, [applySourceContentWithHistory]);

  const insertSourcePrefix = useCallback((prefix: string) => {
    const textarea = sourceTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const currentText = textarea.value;
    
    // Encontrar o início da linha atual
    let lineStart = start;
    while (lineStart > 0 && currentText[lineStart - 1] !== "\n") {
      lineStart--;
    }

    const nextValue = currentText.substring(0, lineStart) + prefix + currentText.substring(lineStart);
    applySourceContentWithHistory(nextValue);
    
    window.requestAnimationFrame(() => {
      const el = sourceTextareaRef.current;
      if (!el) return;
      el.focus();
      const newPos = start + prefix.length;
      el.setSelectionRange(newPos, newPos);
    });
  }, [applySourceContentWithHistory]);

  const handleSourceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      // Interceptar atalhos de sistema/markdown
      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        
        if (key === 'z') {
          event.preventDefault();
          dispatchEditorUndo();
          return;
        }
        if (key === 'y' || (key === 'z' && event.shiftKey)) {
          event.preventDefault();
          dispatchEditorRedo();
          return;
        }
        
        if (key === 'b') {
          event.preventDefault();
          applySourceFormatting("**");
          return;
        }
        if (key === 'i') {
          event.preventDefault();
          applySourceFormatting("_");
          return;
        }
        if (key === 'u') {
          event.preventDefault();
          applySourceFormatting("<u>", "</u>");
          return;
        }
      }

      // Insert a tab character at the cursor position without moving focus.
      if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        sourceInitialFocusPendingRef.current = false;

        const textarea = event.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const nextValue =
          textarea.value.substring(0, start) + "\t" + textarea.value.substring(end);

        applySourceContentWithHistory(nextValue);

        // Restore caret position after React re-renders the controlled textarea.
        window.requestAnimationFrame(() => {
          const el = sourceTextareaRef.current;
          if (!el) return;
          el.setSelectionRange(start + 1, start + 1);
        });
        return;
      }

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
    [scrollSourceContainerToBoundary, applySourceContentWithHistory, applySourceFormatting]
  );

  const showSourceMode =
    viewMode === "source" && (isMarkdownDocument || isPlainTextDocument);
  const showPdfMode = isPdfDocument && Boolean(documentPath);
  const showDocxMode = isDocxDocument && Boolean(documentPath);

  const shouldShowSourceLineNumbers =
    showSourceMode && showSourceLineNumbers && isPlainTextDocument;

  const sourceContentLineCount = useMemo(
    () => Math.max(1, sourceContent.split(/\r\n|\n|\r/).length),
    [sourceContent]
  );

  const sourceLineCount = useMemo(
    () => Math.max(sourceContentLineCount, sourceDisplayLineCount),
    [sourceContentLineCount, sourceDisplayLineCount]
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
    const scrollContainer = sourceScrollContainerRef.current;
    const preservedScrollTop = scrollContainer?.scrollTop ?? 0;

    textarea.style.height = "auto";
    const scrollContainerStyles = scrollContainer
      ? window.getComputedStyle(scrollContainer)
      : null;
    const containerVerticalPadding = scrollContainerStyles
      ? (Number.parseFloat(scrollContainerStyles.paddingTop || "0") || 0) +
        (Number.parseFloat(scrollContainerStyles.paddingBottom || "0") || 0)
      : 0;
    const viewportMinHeight = scrollContainer
      ? Math.max(0, scrollContainer.clientHeight - containerVerticalPadding - 2)
      : 0;
    const minHeight = Math.max(560, viewportMinHeight);
    const nextHeight = Math.max(minHeight, textarea.scrollHeight);
    textarea.style.height = `${nextHeight}px`;

    const textareaStyles = window.getComputedStyle(textarea);
    const resolvedLineHeight = resolveLineHeightPx(textareaStyles);
    const verticalPadding =
      (Number.parseFloat(textareaStyles.paddingTop || "0") || 0) +
      (Number.parseFloat(textareaStyles.paddingBottom || "0") || 0);
    const renderedHeight = textarea.clientHeight || nextHeight;
    const drawableHeight = Math.max(0, renderedHeight - verticalPadding);
    const visualLineCount = Math.max(
      1,
      Math.ceil(drawableHeight / resolvedLineHeight)
    );

    setSourceDisplayLineCount((currentCount) =>
      currentCount === visualLineCount ? currentCount : visualLineCount
    );

    if (scrollContainer && scrollContainer.scrollTop !== preservedScrollTop) {
      scrollContainer.scrollTop = preservedScrollTop;
    }
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

    const handleUndo = () => {
      if (sourceUndoStackRef.current.length === 0) return;
      const current = sourceTextareaRef.current?.value || sourceContent;
      const previous = sourceUndoStackRef.current.pop();
      if (previous !== undefined) {
        sourceRedoStackRef.current.push(current);
        forceUpdateHistory((v) => v + 1);
        applySourceContent(previous);
        setTimeout(() => sourceTextareaRef.current?.focus(), 0);
      }
    };
    
    const handleRedo = () => {
      if (sourceRedoStackRef.current.length === 0) return;
      const current = sourceTextareaRef.current?.value || sourceContent;
      const next = sourceRedoStackRef.current.pop();
      if (next !== undefined) {
        sourceUndoStackRef.current.push(current);
        forceUpdateHistory((v) => v + 1);
        applySourceContent(next);
        setTimeout(() => sourceTextareaRef.current?.focus(), 0);
      }
    };
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

    // For markdown, preserve scroll/caret context when toggling rendered <-> source.
    if (isMarkdownDocument) {
      sourceInitialFocusPendingRef.current = false;
      return;
    }

    sourceInitialFocusPendingRef.current = true;
    focusSourceAtStart();
  }, [showSourceMode, documentId, isMarkdownDocument, focusSourceAtStart]);

  useEffect(() => {
    setSourceDisplayLineCount(1);
  }, [documentId]);

  useEffect(() => {
    renderedScrollRatioRef.current = 0;
    sourceScrollRatioRef.current = 0;
    previousViewModeRef.current = viewMode;
  }, [documentId]);

  useEffect(() => {
    return () => {
      if (sourceFocusRafRef.current !== null) {
        window.cancelAnimationFrame(sourceFocusRafRef.current);
      }
    };
  }, []);

  const handleSourceChange = (value: string) => {
      sourceInitialFocusPendingRef.current = false;
      const current = sourceTextareaRef.current?.value || "";
      sourceUndoStackRef.current.push(current);
      sourceRedoStackRef.current = [];
      forceUpdateHistory((v) => v + 1);
      applySourceContent(value);
  };

  if (showPdfMode && documentPath) {
    return (
      <main className="app-document-area flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-bg)]/20">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--app-border)]/70 outline-none">
          <PdfDocumentView filePath={documentPath} />
        </div>
      </main>
    );
  }

  if (showDocxMode && documentPath) {
    return (
      <main className="app-document-area flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-bg)]/20">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--app-border)]/70 outline-none">
          <DocxDocumentView filePath={documentPath} />
        </div>
      </main>
    );
  }

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
                canUndo={hasSourceUndoState}
                canRedo={hasSourceRedoState}
                onUndo={dispatchEditorUndo}
                onRedo={dispatchEditorRedo}
                onCut={dispatchEditorCut}
                onCopy={dispatchEditorCopy}
                onPaste={dispatchEditorPaste}
                canCut
                canCopy
                canPaste
                
                // --- Formatação de Source Mode Repassada ---
                onToggleBold={() => applySourceFormatting("**", "**", t("toolbar_bold"))}
                onToggleItalic={() => applySourceFormatting("_", "_", t("toolbar_italic"))}
                onToggleUnderline={() => applySourceFormatting("<u>", "</u>", t("toolbar_underline"))}
                onToggleCode={() => applySourceFormatting("`", "`", "code")}
                onToggleHeading1={() => insertSourcePrefix("# ")}
                onToggleHeading2={() => insertSourcePrefix("## ")}
                onToggleHeading3={() => insertSourcePrefix("### ")}
                onToggleBulletList={() => insertSourcePrefix("- ")}
                onToggleOrderedList={() => insertSourcePrefix("1. ")}
                onToggleBlockquote={() => insertSourcePrefix("> ")}
                onToggleCodeBlock={() => applySourceFormatting("```\n", "\n```\n", "code\n")}
                onInsertTable={() => insertSourcePrefix("| Col 1 | Col 2 | Col 3 |\n| --- | --- | --- |\n|  |  |  |")}
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
              chatConfigVersion={chatConfigVersion}
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
