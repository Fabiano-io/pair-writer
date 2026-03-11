import { type Editor } from "@tiptap/react";

function ToolbarButton({
  isActive,
  onClick,
  disabled,
  children,
  title,
}: {
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-1.5 text-xs font-semibold rounded transition-colors ${
        disabled
          ? "text-zinc-600 cursor-not-allowed"
          : isActive
            ? "bg-zinc-800 text-zinc-50 shadow-sm"
            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-zinc-800 mx-1" />;
}

interface EditorToolbarProps {
  editor: Editor | null;
  onSave?: () => void;
  isSaveable?: boolean;
}

export function EditorToolbar({
  editor,
  onSave,
  isSaveable = false,
}: EditorToolbarProps) {
  if (!editor) {
    return null;
  }

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 mb-4 border border-zinc-800 rounded-lg bg-zinc-950/80 w-full select-none">
      {/* History + Save */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!canUndo}
        title="Undo (Cmd+Z)"
      >
        Undo
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!canRedo}
        title="Redo (Cmd+Shift+Z)"
      >
        Redo
      </ToolbarButton>
      <ToolbarButton
        onClick={onSave ?? (() => {})}
        disabled={!isSaveable}
        title="Save (Cmd+S)"
      >
        Save
      </ToolbarButton>

      <ToolbarDivider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Cmd+B)"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Cmd+I)"
      >
        I
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline"
      >
        U
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline Code (Cmd+E)"
      >
        {"<>"}
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Ordered List"
      >
        1. List
      </ToolbarButton>

      <ToolbarDivider />

      {/* Blocks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Blockquote"
      >
        &quot; Quote
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="Code Block"
      >
        {`{ } Code`}
      </ToolbarButton>

      <ToolbarDivider />

      {/* Table (provisional support) */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        title="Insert table (3x3)"
      >
        Table
      </ToolbarButton>
    </div>
  );
}
