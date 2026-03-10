import { type Editor } from "@tiptap/react";

interface EditorBubbleMenuProps {
  editor: Editor;
}

function BubbleMenuButton({
  isActive,
  onClick,
  children,
  title,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2 py-1.5 text-xs font-semibold rounded transition-colors ${
        isActive
          ? "bg-zinc-800 text-zinc-50 shadow-sm"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function BubbleMenuDivider() {
  return <div className="w-px h-4 bg-zinc-800 mx-1" />;
}

/**
 * Lightweight contextual bubble menu over text selection.
 * Complements the fixed toolbar with quick-edit actions on selection.
 */
export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  return (
    <div className="editor-bubble-menu flex items-center gap-1 px-2 py-1.5 border border-zinc-800 rounded-lg bg-zinc-950/95 shadow-lg select-none">
      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Cmd+B)"
      >
        B
      </BubbleMenuButton>
      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Cmd+I)"
      >
        I
      </BubbleMenuButton>
      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline Code (Cmd+E)"
      >
        {"<>"}
      </BubbleMenuButton>

      <BubbleMenuDivider />

      <BubbleMenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Blockquote"
      >
        &quot; Quote
      </BubbleMenuButton>
    </div>
  );
}
