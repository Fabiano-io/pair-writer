import { useState, useCallback } from "react";
import { type Editor } from "@tiptap/react";
import { TipTapEditor } from "./TipTapEditor";
import { EditorToolbar } from "./EditorToolbar";

interface DocumentEditorSurfaceProps {
  title?: string;
  content?: string;
  onTitleChange?: (title: string) => void;
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  isSaveable?: boolean;
  readOnly?: boolean;
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
}: DocumentEditorSurfaceProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const handleEditorReady = useCallback((e: Editor) => setEditor(e), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col outline-none">
      {!readOnly && (
        <div className="shrink-0">
          <EditorToolbar
            editor={editor}
            onSave={onSave}
            isSaveable={isSaveable}
          />
        </div>
      )}

      <article className="min-h-0 flex-1 overflow-y-auto">
        <TipTapEditor
          content={content}
          onContentChange={onContentChange}
          onEditorReady={handleEditorReady}
          readOnly={readOnly}
        />
      </article>
    </div>
  );
}
