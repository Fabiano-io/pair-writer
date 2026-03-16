import { useEffect, useRef, useState } from "react";

export interface WorkspaceTab {
  id: string;
  label: string;
}

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  dirtyTabIds: Set<string>;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabReorder: (
    sourceId: string,
    targetId: string,
    position: "before" | "after"
  ) => void;
}

interface PointerDragState {
  pointerId: number;
  tabId: string;
  startX: number;
  startY: number;
}

interface DropTarget {
  tabId: string;
  position: "before" | "after";
}

export function WorkspaceTabs({
  tabs,
  activeTabId,
  dirtyTabIds,
  onTabSelect,
  onTabClose,
  onTabReorder,
}: WorkspaceTabsProps) {
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const suppressClickRef = useRef(false);

  const clearDragState = () => {
    pointerDragRef.current = null;
    setDraggingTabId(null);
    setDropTarget(null);
  };

  useEffect(() => {
    if (!draggingTabId) return;

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "grabbing";

    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [draggingTabId]);

  useEffect(() => {
    const resolveDropTarget = (clientX: number, clientY: number): DropTarget | null => {
      for (const tab of tabs) {
        const element = tabRefs.current[tab.id];
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const isWithinX = clientX >= rect.left && clientX <= rect.right;
        const isWithinY = clientY >= rect.top && clientY <= rect.bottom;
        if (!isWithinX || !isWithinY) continue;

        const midpoint = rect.left + rect.width / 2;
        return {
          tabId: tab.id,
          position: clientX < midpoint ? "before" : "after",
        };
      }

      return null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = pointerDragRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      const distance = Math.hypot(
        event.clientX - dragState.startX,
        event.clientY - dragState.startY
      );

      if (draggingTabId === null && distance < 6) {
        return;
      }

      if (draggingTabId === null) {
        suppressClickRef.current = true;
        setDraggingTabId(dragState.tabId);
      }

      event.preventDefault();

      const nextTarget = resolveDropTarget(event.clientX, event.clientY);
      setDropTarget(nextTarget);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = pointerDragRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      if (
        draggingTabId !== null &&
        dropTarget &&
        dropTarget.tabId !== dragState.tabId
      ) {
        onTabReorder(dragState.tabId, dropTarget.tabId, dropTarget.position);
      }

      clearDragState();

      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [draggingTabId, dropTarget, onTabReorder, tabs]);

  return (
    <div
      className={`flex shrink-0 items-end gap-0 border-b border-[var(--app-border)] bg-[var(--app-bg)] px-2 pt-2 ${
        draggingTabId ? "cursor-grabbing" : ""
      }`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isDirty = dirtyTabIds.has(tab.id);
        const isHovered = hoveredTabId === tab.id;
        const isDraggedTab = draggingTabId === tab.id;
        const showLeftIndicator =
          dropTarget?.tabId === tab.id &&
          dropTarget.position === "before" &&
          draggingTabId !== tab.id;
        const showRightIndicator =
          dropTarget?.tabId === tab.id &&
          dropTarget.position === "after" &&
          draggingTabId !== tab.id;

        return (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[tab.id] = element;
            }}
            type="button"
            onClick={() => {
              if (suppressClickRef.current) return;
              onTabSelect(tab.id);
            }}
            onMouseEnter={() => setHoveredTabId(tab.id)}
            onMouseLeave={() => setHoveredTabId(null)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              if (!(event.target instanceof HTMLElement)) return;
              if (event.target.closest("[data-tab-close-button='true']")) return;

              pointerDragRef.current = {
                pointerId: event.pointerId,
                tabId: tab.id,
                startX: event.clientX,
                startY: event.clientY,
              };
            }}
            className={`group relative flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm transition-colors cursor-grab active:cursor-grabbing select-none ${
              isActive
                ? "bg-[var(--app-surface)] text-[var(--app-text)] font-medium"
                : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]/50 hover:text-[var(--app-text)]/80"
            } ${isDraggedTab ? "opacity-70" : ""}`}
          >
            {showLeftIndicator && (
              <span className="absolute bottom-1 top-1 left-0 w-0.5 rounded-full bg-[var(--app-text)]/80" />
            )}
            {showRightIndicator && (
              <span className="absolute bottom-1 top-1 right-0 w-0.5 rounded-full bg-[var(--app-text)]/80" />
            )}

            <span className="truncate">{tab.label}</span>
            <span
              data-tab-close-button="true"
              className={`flex h-4 w-4 items-center justify-center text-xs transition-opacity cursor-pointer select-none ${
                isActive
                  ? "text-[var(--app-text-muted)] opacity-100 hover:text-[var(--app-text)]/80"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onTabClose(tab.id);
              }}
            >
              {isDirty && !isHovered ? (
                <span className="h-2 w-2 rounded-full bg-zinc-400" />
              ) : (
                "x"
              )}
            </span>

            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-[var(--app-surface)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
