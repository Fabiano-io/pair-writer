import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "../features/settings/i18n/useTranslation";
import { useDialogA11y } from "./useDialogA11y";

interface MenuItem {
  key: string;
  labelKey: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void;
}

interface MenuGroup {
  key: string;
  labelKey: string;
  items: MenuItem[];
}

interface AppMenuBarProps {
  hasActiveTab: boolean;
  canExportPdf: boolean;
  isSaveable: boolean;
  hasProject: boolean;
  onOpenProject: () => void;
  onExportPdf: () => void;
  onExitApp: () => void;
  onCloseActiveTab: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onNewDocument: () => void;
  onToggleExplorer: () => void;
  onToggleChat: () => void;
  onOpenPreferences: () => void;
  explorerVisible: boolean;
  chatVisible: boolean;
}

export function AppMenuBar({
  hasActiveTab,
  canExportPdf,
  isSaveable,
  hasProject,
  onOpenProject,
  onExportPdf,
  onExitApp,
  onCloseActiveTab,
  onCut,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onSave,
  onNewDocument,
  onToggleExplorer,
  onToggleChat,
  onOpenPreferences,
  explorerVisible,
  chatVisible,
}: AppMenuBarProps) {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const aboutCloseButtonRef = useRef<HTMLButtonElement>(null);
  const aboutTitleId = useId();

  const close = useCallback(() => setOpenMenu(null), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const aboutDialogRef = useDialogA11y({
    isOpen: aboutOpen,
    onClose: closeAbout,
    initialFocusRef: aboutCloseButtonRef,
  });

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu, close]);

  const menus: MenuGroup[] = [
    {
      key: "file",
      labelKey: "menu_file",
      items: [
        {
          key: "open_project",
          labelKey: "menu_open_project",
          shortcut: "Ctrl+O",
          action: () => {
            onOpenProject();
            close();
          },
        },
        {
          key: "new",
          labelKey: "menu_new_document",
          disabled: !hasProject,
          action: () => {
            onNewDocument();
            close();
          },
        },
        {
          key: "save",
          labelKey: "menu_save",
          shortcut: "Ctrl+S",
          disabled: !isSaveable,
          action: () => {
            onSave();
            close();
          },
        },
        {
          key: "export_pdf",
          labelKey: "menu_export_pdf",
          disabled: !canExportPdf,
          action: () => {
            onExportPdf();
            close();
          },
        },
        {
          key: "close",
          labelKey: "menu_close_tab",
          disabled: !hasActiveTab,
          action: () => {
            onCloseActiveTab();
            close();
          },
        },
        {
          key: "exit",
          labelKey: "menu_exit",
          action: () => {
            onExitApp();
            close();
          },
        },
      ],
    },
    {
      key: "edit",
      labelKey: "menu_edit",
      items: [
        {
          key: "undo",
          labelKey: "menu_undo",
          shortcut: "Ctrl+Z",
          disabled: !hasActiveTab,
          action: () => {
            onUndo();
            close();
          },
        },
        {
          key: "redo",
          labelKey: "menu_redo",
          shortcut: "Ctrl+Y",
          disabled: !hasActiveTab,
          action: () => {
            onRedo();
            close();
          },
        },
        {
          key: "cut",
          labelKey: "menu_cut",
          shortcut: "Ctrl+X",
          disabled: !hasActiveTab,
          action: () => {
            onCut();
            close();
          },
        },
        {
          key: "copy",
          labelKey: "menu_copy",
          shortcut: "Ctrl+C",
          disabled: !hasActiveTab,
          action: () => {
            onCopy();
            close();
          },
        },
        {
          key: "paste",
          labelKey: "menu_paste",
          shortcut: "Ctrl+V",
          disabled: !hasActiveTab,
          action: () => {
            onPaste();
            close();
          },
        },
      ],
    },
    {
      key: "view",
      labelKey: "menu_view",
      items: [
        {
          key: "explorer",
          labelKey: explorerVisible ? "menu_hide_explorer" : "menu_show_explorer",
          action: () => {
            onToggleExplorer();
            close();
          },
        },
        {
          key: "chat",
          labelKey: chatVisible ? "menu_hide_chat" : "menu_show_chat",
          action: () => {
            onToggleChat();
            close();
          },
        },
        {
          key: "prefs",
          labelKey: "menu_preferences",
          action: () => {
            onOpenPreferences();
            close();
          },
        },
      ],
    },
    {
      key: "help",
      labelKey: "menu_help",
      items: [
        {
          key: "about",
          labelKey: "menu_about",
          action: () => {
            setAboutOpen(true);
            close();
          },
        },
      ],
    },
  ];

  return (
    <>
      <div
        ref={barRef}
        className="flex shrink-0 items-center gap-0 border-b border-[var(--app-border)] bg-[var(--app-bg)] px-1"
        style={{ height: 32 }}
      >
        {menus.map((menu) => (
          <div key={menu.key} className="relative">
            <button
              type="button"
              className={`px-2.5 py-1 text-xs transition-colors rounded ${
                openMenu === menu.key
                  ? "bg-[var(--app-surface-alt)] text-[var(--app-text)]"
                  : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
              }`}
              onClick={() =>
                setOpenMenu((prev) => (prev === menu.key ? null : menu.key))
              }
              onMouseEnter={() => {
                if (openMenu !== null) setOpenMenu(menu.key);
              }}
            >
              {t(menu.labelKey as never)}
            </button>

            {openMenu === menu.key && (
              <div className="absolute left-0 top-full z-50 mt-px min-w-[180px] rounded border border-[var(--app-border)] bg-[var(--app-surface)] py-1 shadow-lg">
                {menu.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={item.disabled}
                    onClick={item.action}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                      item.disabled
                        ? "cursor-default text-[var(--app-text-muted)]/60"
                        : "text-[var(--app-text)]/80 hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
                    }`}
                  >
                    <span>{t(item.labelKey as never)}</span>
                    {item.shortcut && (
                      <span className="ml-4 text-[10px] text-[var(--app-text-muted)]/70">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {aboutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeAbout}
        >
          <div
            ref={aboutDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={aboutTitleId}
            tabIndex={-1}
            className="w-72 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={aboutTitleId} className="text-sm font-semibold text-[var(--app-text)]">
              {t("about_title")}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
              {t("about_description")}
            </p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]/70">
              {t("about_version")}
            </p>
            <button
              ref={aboutCloseButtonRef}
              type="button"
              onClick={closeAbout}
              className="mt-4 w-full rounded bg-[var(--app-surface-alt)] px-3 py-1.5 text-xs text-[var(--app-text)] transition-colors hover:opacity-90"
            >
              {t("about_close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
