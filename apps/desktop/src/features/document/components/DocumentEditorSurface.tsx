import { useRef, useEffect, type ChangeEvent } from "react";

interface DocumentEditorSurfaceProps {
  title: string;
  content?: string;
  onTitleChange?: (title: string) => void;
  onContentChange?: (content: string) => void;
  readOnly?: boolean;
}

export function DocumentEditorSurface({
  title,
  content,
  onTitleChange,
  readOnly = false,
}: DocumentEditorSurfaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize title textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [title]);

  const handleTitleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onTitleChange?.(e.target.value);
  };

  return (
    <div className="w-full flex-col outline-none">
      {/* Document Header (Provisional Textarea until TipTap integration) */}
      <header className="mb-12">
        <textarea
          ref={textareaRef}
          value={title}
          onChange={handleTitleChange}
          readOnly={readOnly}
          rows={1}
          className="w-full resize-none overflow-hidden bg-transparent text-4xl lg:text-5xl font-bold tracking-tight text-zinc-100 placeholder-zinc-700 outline-none"
          placeholder="Document Title"
        />
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <span>Draft</span>
          <span>·</span>
          <span>Last edited just now</span>
        </div>
      </header>

      {/* Editor Content Surface (Provisional placeholder until TipTap) */}
      <article className="min-h-[50vh] cursor-text space-y-6 text-base leading-relaxed text-zinc-300">
        {content !== undefined ? (
          <div className="prose prose-invert max-w-none">{content}</div>
        ) : (
          <>
            <p>
              Pair Writer is a desktop writing environment designed for structured thinking and AI-assisted content creation. It combines a focused document editor with contextual AI chat that lives alongside each document.
            </p>
            <p>
              The core experience prioritizes rendered content over raw markup, delivering an editorial feel that keeps writers immersed in their ideas rather than formatting syntax.
            </p>

            <h2 className="text-xl font-semibold text-zinc-200 mt-8">
              Core Principles
            </h2>
            <ul className="space-y-2 pl-5 mt-4">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 text-xs text-emerald-400">
                  ✓
                </span>
                <span>Document-first experience with contextual AI</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 text-xs text-emerald-400">
                  ✓
                </span>
                <span>Chat belongs to the document, not to the application</span>
              </li>
            </ul>
          </>
        )}
      </article>
    </div>
  );
}
