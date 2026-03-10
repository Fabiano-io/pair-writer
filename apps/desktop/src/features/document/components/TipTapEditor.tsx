import { useEditor, EditorContent } from "@tiptap/react";
import { EditorToolbar } from "./EditorToolbar";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";

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
  // Provisional: StarterKit is the initial extension set and is not the final
  // editor configuration for the product.
  //
  // StarterKit v3 already includes active input rules for basic authoring:
  //   - Headings: "# " → h1, "## " → h2, "### " → h3 (up to h6)
  //   - Bullet list: "- " or "* " at line start
  //   - Ordered list: "1. " at line start
  //   - Blockquote: "> " at line start
  //   - Code block: "```" at line start
  //   - Inline code: "`text`"
  //   - Bold: "**text**" or "__text__"
  //   - Italic: "*text*" or "_text_"
  // No additional configuration is needed to enable these behaviors.
  const editor = useEditor({
    extensions: [
      StarterKit,
      // Placeholder activates the .is-editor-empty CSS class used in index.css
      // to render the placeholder text when the editor is empty.
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
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
    <div className="flex flex-col w-full">
      {!readOnly && <EditorToolbar editor={editor} />}
      {/* tiptap-body is a provisional CSS namespace scoped in index.css.
          Typography and color styles are handled there to keep this component clean.
          min-h ensures the editor area is always clickable even when empty. */}
      <EditorContent
        editor={editor}
        className="tiptap-body w-full min-h-[500px] text-base leading-relaxed"
      />
    </div>
  );
}
