import { type Editor, useEditorState } from "@tiptap/react";
import {
  copyEditorSelection,
  cutEditorSelection,
  pasteIntoEditor,
} from "../editorClipboard";
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
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onCut?: () => void | Promise<void>;
  onCopy?: () => void | Promise<void>;
  onPaste?: () => void | Promise<void>;
  canCut?: boolean;
  canCopy?: boolean;
  canPaste?: boolean;
}

export function EditorToolbar({
  editor,
  onSave,
  isSaveable = false,
  canToggleMarkdownView = false,
  markdownViewMode = "rendered",
  onToggleMarkdownView,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCut,
  onCopy,
  onPaste,
  canCut,
  canCopy,
  canPaste,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const hasEditor = editor !== null;

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return null;
      }

      return {
        canUndo: currentEditor.can().undo(),
        canRedo: currentEditor.can().redo(),
        hasSelection:
          currentEditor.state.selection.from !== currentEditor.state.selection.to,
        canInsertTable: currentEditor
          .can()
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
        isBold: currentEditor.isActive("bold"),
        isItalic: currentEditor.isActive("italic"),
        isUnderline: currentEditor.isActive("underline"),
        isCode: currentEditor.isActive("code"),
        isHeading1: currentEditor.isActive("heading", { level: 1 }),
        isHeading2: currentEditor.isActive("heading", { level: 2 }),
        isHeading3: currentEditor.isActive("heading", { level: 3 }),
        isBulletList: currentEditor.isActive("bulletList"),
        isOrderedList: currentEditor.isActive("orderedList"),
        isBlockquote: currentEditor.isActive("blockquote"),
        isCodeBlock: currentEditor.isActive("codeBlock"),
      };
    },
  });

  const internalCanUndo = editorState?.canUndo ?? false;
  const internalCanRedo = editorState?.canRedo ?? false;
  const internalHasSelection = editorState?.hasSelection ?? false;
  const canInsertTable = editorState?.canInsertTable ?? false;

  const hasExternalUndoRedo =
    !hasEditor && (onUndo !== undefined || onRedo !== undefined);
  const canRunUndo = hasEditor ? internalCanUndo : (canUndo ?? Boolean(onUndo));
  const canRunRedo = hasEditor ? internalCanRedo : (canRedo ?? Boolean(onRedo));
  const shouldShowUndoRedo = hasEditor || hasExternalUndoRedo;

  const hasExternalClipboard =
    !hasEditor && (onCut !== undefined || onCopy !== undefined || onPaste !== undefined);
  const canRunCut = hasEditor ? internalHasSelection : (canCut ?? Boolean(onCut));
  const canRunCopy = hasEditor ? internalHasSelection : (canCopy ?? Boolean(onCopy));
  const canRunPaste = hasEditor ? true : (canPaste ?? Boolean(onPaste));
  const shouldShowClipboard = hasEditor || hasExternalClipboard;

  const handleUndo = () => {
    if (hasEditor && editor) {
      editor.chain().focus().undo().run();
      return;
    }

    onUndo?.();
  };

  const handleRedo = () => {
    if (hasEditor && editor) {
      editor.chain().focus().redo().run();
      return;
    }

    onRedo?.();
  };

  const handleCut = async () => {
    if (hasEditor && editor) {
      await cutEditorSelection(editor);
      return;
    }

    await onCut?.();
  };

  const handleCopy = async () => {
    if (hasEditor && editor) {
      await copyEditorSelection(editor);
      return;
    }

    await onCopy?.();
  };

  const handlePaste = async () => {
    if (hasEditor && editor) {
      await pasteIntoEditor(editor);
      return;
    }

    await onPaste?.();
  };

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
      {shouldShowUndoRedo && (
        <>
          <ToolbarButton
            onClick={handleUndo}
            disabled={!canRunUndo}
            title="Undo (Ctrl+Z)"
          >
            {t("toolbar_undo")}
          </ToolbarButton>
          <ToolbarButton
            onClick={handleRedo}
            disabled={!canRunRedo}
            title="Redo (Ctrl+Y)"
          >
            {t("toolbar_redo")}
          </ToolbarButton>
        </>
      )}

      {shouldShowClipboard && (
        <>
          <ToolbarButton
            onClick={() => {
              void handleCut();
            }}
            disabled={!canRunCut}
            title="Cut (Ctrl+X)"
          >
            {t("toolbar_cut")}
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              void handleCopy();
            }}
            disabled={!canRunCopy}
            title="Copy (Ctrl+C)"
          >
            {t("toolbar_copy")}
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              void handlePaste();
            }}
            disabled={!canRunPaste}
            title="Paste (Ctrl+V)"
          >
            {t("toolbar_paste")}
          </ToolbarButton>
        </>
      )}

      <ToolbarButton
        onClick={onSave ?? (() => {})}
        disabled={!isSaveable}
        title="Save (Ctrl+S)"
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
            isActive={editorState?.isBold}
            title={t("toolbar_bold")}
          >
            B
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editorState?.isItalic}
            title={t("toolbar_italic")}
          >
            I
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editorState?.isUnderline}
            title={t("toolbar_underline")}
          >
            U
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editorState?.isCode}
            title={t("toolbar_code")}
          >
            {"<>"}
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editorState?.isHeading1}
            title={t("toolbar_h1")}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editorState?.isHeading2}
            title={t("toolbar_h2")}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editorState?.isHeading3}
            title={t("toolbar_h3")}
          >
            H3
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editorState?.isBulletList}
            title={t("toolbar_bullet_list")}
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editorState?.isOrderedList}
            title={t("toolbar_ordered_list")}
          >
            1. List
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editorState?.isBlockquote}
            title={t("toolbar_blockquote")}
          >
            &quot; Quote
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editorState?.isCodeBlock}
            title={t("toolbar_code_block")}
          >
            {`{ } Code`}
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            disabled={!canInsertTable}
            title={t("toolbar_table")}
          >
            Table
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
