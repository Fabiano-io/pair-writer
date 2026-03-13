import { type Editor, useEditorState } from "@tiptap/react";
import { useEffect, useId, useRef, useState } from "react";
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
  ariaLabel,
}: {
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
  ariaLabel?: string;
}) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipAlign, setTooltipAlign] = useState<"center" | "left" | "right">(
    "center",
  );
  const [tooltipPlacement, setTooltipPlacement] = useState<"bottom" | "top">(
    "bottom",
  );

  const clearTooltipTimer = () => {
    if (timerRef.current === null) {
      return;
    }

    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const scheduleTooltip = (visible: boolean, delayMs: number) => {
    if (!title) {
      return;
    }

    clearTooltipTimer();
    timerRef.current = window.setTimeout(() => {
      setIsTooltipVisible(visible);
      timerRef.current = null;
    }, delayMs);
  };

  const updateTooltipPlacement = () => {
    if (!buttonRef.current || !tooltipRef.current) {
      return;
    }

    const triggerRect = buttonRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const centerX = triggerRect.left + triggerRect.width / 2;

    let nextAlign: "center" | "left" | "right" = "center";
    if (centerX - tooltipRect.width / 2 < viewportPadding) {
      nextAlign = "left";
    } else if (centerX + tooltipRect.width / 2 > window.innerWidth - viewportPadding) {
      nextAlign = "right";
    }

    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const minSpaceNeeded = tooltipRect.height + 12;
    const nextPlacement =
      spaceBelow >= minSpaceNeeded || spaceBelow >= spaceAbove ? "bottom" : "top";

    setTooltipAlign(nextAlign);
    setTooltipPlacement(nextPlacement);
  };

  useEffect(() => {
    if (!isTooltipVisible) {
      return;
    }

    updateTooltipPlacement();

    const handleWindowChange = () => {
      updateTooltipPlacement();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isTooltipVisible]);

  useEffect(() => {
    return () => {
      clearTooltipTimer();
    };
  }, []);

  const tooltipAlignClass =
    tooltipAlign === "center"
      ? "left-1/2 -translate-x-1/2"
      : tooltipAlign === "left"
        ? "left-0"
        : "right-0";
  const tooltipPlacementClass =
    tooltipPlacement === "bottom" ? "top-full mt-2" : "bottom-full mb-2";
  const tooltipMotionClass = isTooltipVisible
    ? "translate-y-0 opacity-100"
    : tooltipPlacement === "bottom"
      ? "translate-y-1 opacity-0"
      : "-translate-y-1 opacity-0";
  const arrowAnchorClass =
    tooltipAlign === "center"
      ? "left-1/2 -translate-x-1/2"
      : tooltipAlign === "left"
        ? "left-3"
        : "right-3";
  const arrowPlacementClass =
    tooltipPlacement === "bottom"
      ? "top-0 -translate-y-1/2 rotate-45 border-l border-t"
      : "bottom-0 translate-y-1/2 rotate-45 border-r border-b";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        scheduleTooltip(true, 120);
      }}
      onMouseLeave={() => {
        scheduleTooltip(false, 60);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        disabled={disabled}
        onFocus={() => {
          scheduleTooltip(true, 120);
        }}
        onBlur={() => {
          setIsTooltipVisible(false);
          clearTooltipTimer();
        }}
        onPointerDown={() => {
          setIsTooltipVisible(false);
          clearTooltipTimer();
        }}
        aria-label={ariaLabel ?? title}
        aria-describedby={title ? tooltipId : undefined}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]/45 ${
          disabled
            ? "text-[var(--app-text-muted)]/45 cursor-not-allowed"
            : isActive
              ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] shadow-[inset_0_0_0_1px_var(--app-border)]"
              : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-alt)]/65 hover:text-[var(--app-text)]"
        }`}
      >
        {children}
      </button>

      {title ? (
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          aria-hidden={!isTooltipVisible}
          className={`pointer-events-none absolute z-40 inline-flex items-center whitespace-nowrap rounded-md border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-2 py-1 text-[11px] font-medium tracking-wide text-[var(--app-text)] shadow-lg backdrop-blur-md transition-all duration-150 ease-out ${tooltipAlignClass} ${tooltipPlacementClass} ${tooltipMotionClass}`}
        >
          <span
            className={`absolute h-2 w-2 border-[var(--app-border)] bg-[var(--app-surface)]/95 ${arrowAnchorClass} ${arrowPlacementClass}`}
          />
          <span className="relative z-10">{title}</span>
        </span>
      ) : null}
    </span>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-[var(--app-border)]" />;
}

function ToolbarIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
      {children}
    </span>
  );
}

function IconUndo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 7H5v4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5 11a7 7 0 1 1 2 4.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRedo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M19 11a7 7 0 1 0-2 4.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="6" cy="17" r="2.2" />
      <path d="m8 8 10 10M8 16l10-10" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M6 15a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2" />
    </svg>
  );
}

function IconPaste() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="6" y="5" width="12" height="15" rx="2" />
      <rect x="9" y="2.5" width="6" height="4" rx="1" />
    </svg>
  );
}

function IconSave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 4h11l3 3v13H5z" strokeLinejoin="round" />
      <path d="M8 4v6h8V4M9 18h6" strokeLinecap="round" />
    </svg>
  );
}

function IconRendered() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.8-6 9.5-6 9.5 6 9.5 6-3.8 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function IconSource() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m8.2 7-4.2 5 4.2 5M15.8 7l4.2 5-4.2 5" strokeLinecap="round" />
      <path d="M13.5 5 10.5 19" strokeLinecap="round" />
    </svg>
  );
}

function IconBold() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 5h6a4 4 0 0 1 0 8H7zm0 8h7a4 4 0 0 1 0 8H7z" />
    </svg>
  );
}

function IconItalic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 5h5M5 19h5M14 5 10 19" strokeLinecap="round" />
    </svg>
  );
}

function IconUnderline() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M7 5v6a5 5 0 0 0 10 0V5" strokeLinecap="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

function IconInlineCode() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m9 7-5 5 5 5M15 7l5 5-5 5" strokeLinecap="round" />
    </svg>
  );
}

function IconHeading({ level }: { level: "1" | "2" | "3" }) {
  return (
    <span className="inline-flex items-end gap-0.5 leading-none font-semibold tracking-tight">
      <span className="text-[11px]">H</span>
      <span className="text-[9px] text-[var(--app-text-muted)]">{level}</span>
    </span>
  );
}

function IconListBullet() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="5.5" cy="7" r="1.2" fill="currentColor" />
      <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5.5" cy="17" r="1.2" fill="currentColor" />
      <path d="M9 7h10M9 12h10M9 17h10" strokeLinecap="round" />
    </svg>
  );
}

function IconListNumber() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3.8 8h2.1M4.2 7.3v3M4 16.5h2.2l-2.2 2.2h2.2" strokeLinecap="round" />
      <path d="M10 7h10M10 12h10M10 17h10" strokeLinecap="round" />
    </svg>
  );
}

function IconQuote() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8.2 9H5.5v6h4.2v-3H8.2zM17.5 9h-2.7v6H19v-3h-1.5z" />
    </svg>
  );
}

function IconCodeBlock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="m10 10-2 2 2 2M14 10l2 2-2 2" strokeLinecap="round" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M4 14h16M9.3 5v14M14.7 5v14" />
    </svg>
  );
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
  const saveLabel = t("menu_save");

  return (
    <div className="relative z-40 isolate mb-4 flex w-full select-none flex-wrap items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)]/82 px-3 py-2 backdrop-blur-sm">
      {shouldShowUndoRedo && (
        <>
          <ToolbarButton
            onClick={handleUndo}
            disabled={!canRunUndo}
            title={`${t("toolbar_undo")} (Ctrl+Z)`}
          >
            <ToolbarIcon>
              <IconUndo />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={handleRedo}
            disabled={!canRunRedo}
            title={`${t("toolbar_redo")} (Ctrl+Y)`}
          >
            <ToolbarIcon>
              <IconRedo />
            </ToolbarIcon>
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
            title={`${t("toolbar_cut")} (Ctrl+X)`}
          >
            <ToolbarIcon>
              <IconCut />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              void handleCopy();
            }}
            disabled={!canRunCopy}
            title={`${t("toolbar_copy")} (Ctrl+C)`}
          >
            <ToolbarIcon>
              <IconCopy />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              void handlePaste();
            }}
            disabled={!canRunPaste}
            title={`${t("toolbar_paste")} (Ctrl+V)`}
          >
            <ToolbarIcon>
              <IconPaste />
            </ToolbarIcon>
          </ToolbarButton>
        </>
      )}

      <ToolbarButton
        onClick={onSave ?? (() => {})}
        disabled={!isSaveable}
        title={`${saveLabel} (Ctrl+S)`}
      >
        <ToolbarIcon>
          <IconSave />
        </ToolbarIcon>
      </ToolbarButton>

      {canToggleMarkdownView && (
        <>
          <ToolbarDivider />
          <ToolbarButton
            onClick={onToggleMarkdownView ?? (() => {})}
            title={toggleTitle}
            disabled={!onToggleMarkdownView}
            ariaLabel={`${viewLabel}. ${toggleTitle}`}
          >
            <ToolbarIcon>
              {markdownViewMode === "rendered" ? <IconRendered /> : <IconSource />}
            </ToolbarIcon>
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
            <ToolbarIcon>
              <IconBold />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editorState?.isItalic}
            title={t("toolbar_italic")}
          >
            <ToolbarIcon>
              <IconItalic />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editorState?.isUnderline}
            title={t("toolbar_underline")}
          >
            <ToolbarIcon>
              <IconUnderline />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editorState?.isCode}
            title={t("toolbar_code")}
          >
            <ToolbarIcon>
              <IconInlineCode />
            </ToolbarIcon>
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editorState?.isHeading1}
            title={t("toolbar_h1")}
          >
            <ToolbarIcon>
              <IconHeading level="1" />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editorState?.isHeading2}
            title={t("toolbar_h2")}
          >
            <ToolbarIcon>
              <IconHeading level="2" />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editorState?.isHeading3}
            title={t("toolbar_h3")}
          >
            <ToolbarIcon>
              <IconHeading level="3" />
            </ToolbarIcon>
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editorState?.isBulletList}
            title={t("toolbar_bullet_list")}
          >
            <ToolbarIcon>
              <IconListBullet />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editorState?.isOrderedList}
            title={t("toolbar_ordered_list")}
          >
            <ToolbarIcon>
              <IconListNumber />
            </ToolbarIcon>
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editorState?.isBlockquote}
            title={t("toolbar_blockquote")}
          >
            <ToolbarIcon>
              <IconQuote />
            </ToolbarIcon>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editorState?.isCodeBlock}
            title={t("toolbar_code_block")}
          >
            <ToolbarIcon>
              <IconCodeBlock />
            </ToolbarIcon>
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
            <ToolbarIcon>
              <IconTable />
            </ToolbarIcon>
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
