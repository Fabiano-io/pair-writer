import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";

interface TipTapEditorProps {
  // Provisional: content is treated as the initial HTML string for this mount cycle.
  // Format and sync contract will be refined in a future cycle.
  content?: string;
  onContentChange?: (html: string) => void;
  readOnly?: boolean;
}

export function TipTapEditor({
  content = "",
  onContentChange,
  readOnly = false,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    // content is used as the initial value only — no controlled sync from prop.
    // Updating content from outside this component is intentionally out of scope
    // for this initial mount cycle to avoid bidirectional sync complexity.
    content,
    editable: !readOnly,
    onUpdate({ editor: updatedEditor }) {
      onContentChange?.(updatedEditor.getHTML());
    },
  });

  return (
    <EditorContent
      editor={editor}
      className="tiptap-body w-full min-h-[500px] text-base leading-relaxed text-zinc-300 outline-none"
    />
  );
}
