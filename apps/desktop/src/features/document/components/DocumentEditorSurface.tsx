import { useRef, useEffect, type ChangeEvent } from "react";
import { TipTapEditor } from "./TipTapEditor";

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
  onContentChange,
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

      {/* Editor body — TipTap initial mount (first step of the real engine).
          Content format and sync contract are provisional for this cycle. */}
      <article className="min-h-[50vh]">
        <TipTapEditor
          content={content}
          onContentChange={onContentChange}
          readOnly={readOnly}
        />
      </article>
    </div>
  );
}
