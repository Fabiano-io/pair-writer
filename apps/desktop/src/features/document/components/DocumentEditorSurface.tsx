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

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange?.(e.target.value);
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
      <article className="min-h-[50vh] flex flex-col space-y-4">
        {/* Subtle Provisional Marker */}
        <div className="flex items-center text-xs font-medium text-amber-500/50 bg-amber-500/10 px-2 py-1 rounded w-max select-none">
          Transitional Plain Text Input
        </div>

        {/* TODO: TIPTAP ENGINE MOUNT POINT */}
        {/* The future TipTap editor component will be injected exactly here.
            It will consume:
            - content (as initial state or TipTap JSON/HTML doc)
            - onContentChange (to sync TipTap updates back to the parent)
            - readOnly
            This <textarea> is strictly provisional and will be completely removed. */}
        <textarea
          value={content || ""}
          onChange={handleContentChange}
          readOnly={readOnly}
          className="w-full flex-1 min-h-[500px] resize-none bg-transparent text-base leading-relaxed text-zinc-300 placeholder-zinc-700 outline-none"
          placeholder="Start typing..."
        />
      </article>
    </div>
  );
}
