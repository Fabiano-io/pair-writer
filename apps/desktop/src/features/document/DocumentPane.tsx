import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { DocumentEditorSurface } from "./components/DocumentEditorSurface";
import { EditorToolbar } from "./components/EditorToolbar";

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
  onToggleMarkdownView,
}: DocumentPaneProps) {
  const [title, setTitle] = useState(initialTitle);
  const [localContent, setLocalContent] = useState(PROVISIONAL_CONTENT);
  const [sourceContent, setSourceContent] = useState("");

  const renderedScrollRef = useRef<HTMLElement | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const renderedScrollRatioRef = useRef(0);
  const sourceScrollRatioRef = useRef(0);
  const previousViewModeRef = useRef<"rendered" | "source">(viewMode);

  const isControlled =
    controlledContent !== undefined && onControlledContentChange !== undefined;
  const content = isControlled ? controlledContent : localContent;
  const setContent = isControlled ? onControlledContentChange : setLocalContent;

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (!isMarkdownDocument || viewMode !== "source") return;
    setSourceContent((current) => (current === content ? current : content));
  }, [content, isMarkdownDocument, viewMode]);

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
      }
    });
  }, [isMarkdownDocument, viewMode]);

  const handleRenderedScroll = useCallback((event: UIEvent<HTMLElement>) => {
    renderedScrollRatioRef.current = getScrollRatio(event.currentTarget);
  }, []);

  const handleSourceScroll = useCallback(
    (event: UIEvent<HTMLTextAreaElement>) => {
      sourceScrollRatioRef.current = getScrollRatio(event.currentTarget);
    },
    []
  );

  const showSourceMode = isMarkdownDocument && viewMode === "source";

  const handleSourceChange = (value: string) => {
    setSourceContent(value);
    setContent(value);
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
                  canToggleMarkdownView
                  markdownViewMode={viewMode}
                  onToggleMarkdownView={onToggleMarkdownView}
                />
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-[var(--app-bg)]/20">
                <textarea
                  ref={sourceTextareaRef}
                  value={sourceContent}
                  onChange={(event) => handleSourceChange(event.target.value)}
                  onScroll={handleSourceScroll}
                  className="h-full min-h-[420px] w-full resize-none rounded-lg bg-transparent p-4 font-mono text-sm leading-relaxed text-[var(--app-text)] outline-none"
                  spellCheck={false}
                />
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