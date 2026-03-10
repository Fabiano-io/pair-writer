import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { EditorBubbleMenu } from "./EditorBubbleMenu";

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

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== undefined && current !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  return (
    <div className="flex min-h-full flex-col w-full">
      <EditorContent
        editor={editor}
        className="tiptap-body w-full min-h-[500px] text-base leading-relaxed"
      />
      {!readOnly && editor && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: e }) => {
            const { from, to } = e.state.selection;
            return from !== to && e.state.doc.textBetween(from, to).trim().length > 0;
          }}
        >
          <EditorBubbleMenu editor={editor} />
        </BubbleMenu>
      )}
    </div>
  );
}
