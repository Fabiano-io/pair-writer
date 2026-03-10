import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";

interface TipTapEditorProps {
  content?: string;
  onContentChange?: (html: string) => void;
  onEditorReady?: (editor: Editor) => void;
  readOnly?: boolean;
}

export function TipTapEditor({
  content = "",
  onContentChange,
  onEditorReady,
  readOnly = false,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content,
    editable: !readOnly,
    onUpdate({ editor: updatedEditor }) {
      onContentChange?.(updatedEditor.getHTML());
    },
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  return (
    <div className="flex min-h-full flex-col w-full">
      <EditorContent
        editor={editor}
        className="tiptap-body w-full min-h-[500px] text-base leading-relaxed"
      />
    </div>
  );
}
