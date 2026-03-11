import { type Editor } from "@tiptap/react";
import { useTranslation } from "../../settings/i18n/useTranslation";

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
          ? "text-[var(--app-text-muted)]/60 cursor-not-allowed"
          : isActive
            ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] shadow-sm"
            : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-alt)]/60 hover:text-[var(--app-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-[var(--app-border)] mx-1" />;
}

interface EditorToolbarProps {
  editor: Editor | null;
  onSave?: () => void;
  isSaveable?: boolean;
  canToggleMarkdownView?: boolean;
  markdownViewMode?: "rendered" | "source";
  onToggleMarkdownView?: () => void;
}

export function EditorToolbar({
  editor,
  onSave,
  isSaveable = false,
  canToggleMarkdownView = false,
  markdownViewMode = "rendered",
  onToggleMarkdownView,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const hasEditor = editor !== null;

  const canUndo = hasEditor ? editor.can().undo() : false;
  const canRedo = hasEditor ? editor.can().redo() : false;
  const viewLabel =
    markdownViewMode === "rendered"
      ? t("status_view_rendered")
      : t("status_view_source");
  const toggleTitle =
    markdownViewMode === "rendered"
      ? t("status_toggle_to_source")
      : t("status_toggle_to_rendered");

  return (
    <div className="flex w-full select-none flex-wrap items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/80 px-3 py-2 mb-4">
      {hasEditor && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            {t("toolbar_undo")}
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
          >
            {t("toolbar_redo")}
          </ToolbarButton>
        </>
      )}

      <ToolbarButton
        onClick={onSave ?? (() => {})}
        disabled={!isSaveable}
        title="Save (Cmd+S)"
      >
        {t("menu_save")}
      </ToolbarButton>

      {canToggleMarkdownView && (
        <>
          <ToolbarDivider />
          <ToolbarButton
            onClick={onToggleMarkdownView ?? (() => {})}
            title={toggleTitle}
            disabled={!onToggleMarkdownView}
          >
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-1 font-mono text-[9px]">
                {markdownViewMode === "rendered" ? "MD" : "<>"}
              </span>
              <span>{viewLabel}</span>
            </span>
          </ToolbarButton>
        </>
      )}

      {hasEditor && (
        <>
          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title={t("toolbar_bold")}
          >
            B
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title={t("toolbar_italic")}
          >
            I
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive("underline")}
            title={t("toolbar_underline")}
          >
            U
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive("code")}
            title={t("toolbar_code")}
          >
            {"<>"}
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive("heading", { level: 1 })}
            title={t("toolbar_h1")}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
            title={t("toolbar_h2")}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive("heading", { level: 3 })}
            title={t("toolbar_h3")}
          >
            H3
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title={t("toolbar_bullet_list")}
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title={t("toolbar_ordered_list")}
          >
            1. List
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
            title={t("toolbar_blockquote")}
          >
            &quot; Quote
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive("codeBlock")}
            title={t("toolbar_code_block")}
          >
            {`{ } Code`}
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            title={t("toolbar_table")}
          >
            Table
          </ToolbarButton>
        </>
      )}
    </div>
  );
}