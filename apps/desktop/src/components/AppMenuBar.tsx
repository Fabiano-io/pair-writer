import { useCallback, useEffect, useRef, useState } from "react";

interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

interface AppMenuBarProps {
  hasActiveTab: boolean;
  isSaveable: boolean;
  hasProject: boolean;
  onCloseActiveTab: () => void;
  onSave: () => void;
  onNewDocument: () => void;
  onToggleExplorer: () => void;
  onToggleChat: () => void;
  explorerVisible: boolean;
  chatVisible: boolean;
}

export function AppMenuBar({
  hasActiveTab,
  isSaveable,
  hasProject,
  onCloseActiveTab,
  onSave,
  onNewDocument,
  onToggleExplorer,
  onToggleChat,
  explorerVisible,
  chatVisible,
}: AppMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenMenu(null), []);

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
      label: "File",
      items: [
        {
          label: "New Document",
          disabled: !hasProject,
          action: () => {
            onNewDocument();
            close();
          },
        },
        {
          label: "Save",
          shortcut: "Ctrl+S",
          disabled: !isSaveable,
          action: () => {
            onSave();
            close();
          },
        },
        {
          label: "Close Tab",
          disabled: !hasActiveTab,
          action: () => {
            onCloseActiveTab();
            close();
          },
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: explorerVisible ? "Hide Explorer" : "Show Explorer",
          action: () => {
            onToggleExplorer();
            close();
          },
        },
        {
          label: chatVisible ? "Hide Chat" : "Show Chat",
          action: () => {
            onToggleChat();
            close();
          },
        },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "About Pair Writer",
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
        className="flex shrink-0 items-center gap-0 border-b border-zinc-800 bg-zinc-950 px-1"
        style={{ height: 32 }}
      >
        {menus.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              type="button"
              className={`px-2.5 py-1 text-xs transition-colors rounded ${
                openMenu === menu.label
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
              onClick={() =>
                setOpenMenu((prev) =>
                  prev === menu.label ? null : menu.label
                )
              }
              onMouseEnter={() => {
                if (openMenu !== null) setOpenMenu(menu.label);
              }}
            >
              {menu.label}
            </button>

            {openMenu === menu.label && (
              <div className="absolute left-0 top-full z-50 mt-px min-w-[180px] rounded border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                {menu.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled={item.disabled}
                    onClick={item.action}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                      item.disabled
                        ? "cursor-default text-zinc-600"
                        : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="ml-4 text-[10px] text-zinc-600">
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
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-zinc-100">
              Pair Writer
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              AI-assisted thinking and writing workspace.
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Version 0.1.0 (preview)
            </p>
            <button
              type="button"
              onClick={() => setAboutOpen(false)}
              className="mt-4 w-full rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
