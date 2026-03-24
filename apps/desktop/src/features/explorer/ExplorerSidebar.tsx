import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useProjectExplorer } from "./useProjectExplorer";
import {
  createProjectFile,
  createProjectFolder,
  deleteProjectEntry,
  moveProjectEntry,
  openInFileExplorer,
  pasteCopiedProjectFile,
  renameProjectEntry,
} from "../project/projectAccess";
import type { DirEntry } from "../project/projectAccess";
import { useTranslation } from "../settings/i18n/useTranslation";
import { useDialogA11y } from "../../components/useDialogA11y";

interface ExplorerSidebarProps {
  width: number;
  activeDocumentId: string | null;
  openDocumentIds?: string[];
  onFileSelect: (path: string) => void;
  onCreateDocument?: (filePath: string) => void;
  onDeleteDocument?: (filePath: string) => void;
  onRenameDocument?: (fromPath: string, toPath: string) => void;
  newDocTrigger?: number;
}

interface ExplorerContextMenuState {
  x: number;
  y: number;
  entryPath: string | null;
  targetDirPath: string;
}

function getFolderName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function getParentFolderPath(path: string): string {
  const separator = path.includes("\\") ? "\\" : "/";
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");

  if (idx <= 0) return path;

  const parent = normalized.slice(0, idx);
  return separator === "\\" ? parent.replace(/\//g, "\\") : parent;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function hasInvalidFilenameChars(value: string): boolean {
  const invalidChars = new Set(["<", ">", ":", '"', "/", "\\", "|", "?", "*"]);

  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code >= 0 && code <= 31) return true;
    if (invalidChars.has(ch)) return true;
  }

  return false;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getPathSeparator(path: string): "\\" | "/" {
  return path.includes("\\") ? "\\" : "/";
}

function joinPath(path: string, name: string): string {
  if (path.endsWith("\\") || path.endsWith("/")) {
    return `${path}${name}`;
  }
  return `${path}${getPathSeparator(path)}${name}`;
}

function getRenameSelectionEnd(name: string): number {
  const lastDot = name.lastIndexOf(".");
  // Preserve extension for common file names like "document.md".
  // Hidden files like ".env" still select the full value.
  if (lastDot <= 0) return name.length;
  return lastDot;
}

function getTreeItemDomId(path: string): string {
  const normalizedPath = normalizePath(path);
  const encodedPath = encodeURIComponent(normalizedPath).replace(/%/g, "_");
  return `explorer-tree-item-${encodedPath}`;
}

// ─── Inline SVG icons ────────────────────────────────────────────────────────

function IconChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M3.5 2.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 1.5h5.5L11.5 5v7.5a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5v-11A.5.5 0 013 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8.5 1.5V5H11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconFolder({ open }: { open?: boolean }) {
  if (open) {
    return (
      <svg width="15" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M1.5 4a1 1 0 011-1h3.25l1.75 1.5H12a1 1 0 011 1v1H1.5V4z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
        <path d="M1.5 7.5h11L11.2 11.3a1 1 0 01-.94.7H3.75a1 1 0 01-.94-.67L1.5 7.5z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="15" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 4a1 1 0 011-1h3.25L7.5 5H12a1 1 0 011 1v5a1 1 0 01-1 1h-9a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    </svg>
  );
}

function IconRefreshSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7a4.5 4.5 0 014.5-4.5 4.5 4.5 0 013.9 2.3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M11.5 7a4.5 4.5 0 01-8.4 2.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M10.5 3.5L12 5l-1.75.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 10.5L2 9l1.75-.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExternalFolder() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 4.5a1 1 0 011-1H6l1.5 1.5H12a1 1 0 011 1V11a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.5 8.5H11m0 0V6m0 2.5L9 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconOpen() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5.5 2.5H3a1 1 0 00-1 1v7a1 1 0 001 1h8a1 1 0 001-1V5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 2.5H11.5V5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7L11.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconRename() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9.5 2.5l2 2-6 6H3.5v-2l6-6z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 12h9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2.5 9.5V3a.5.5 0 01.5-.5h6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPaste() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5V3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M9 5.5h1.5a1 1 0 011 1V12a1 1 0 01-1 1H5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 4h9M5.5 4V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5V4M5.5 6.5V10M8.5 6.5V10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 4l.5 7.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5L10.5 4" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconNewDoc() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 1.5h5.5L11.5 5v7.5a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5v-11A.5.5 0 013 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.5 1.5V5H11.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M5.5 9h3M7 7.5V10.5" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}

function IconNewFolder() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 4.5a1 1 0 011-1H6L7.5 5H12a1 1 0 011 1v5a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M7 7.5v3M5.5 9h3" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  );
}

function IconChangeFolderSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 4.5a1 1 0 011-1H6L7.5 5H12a1 1 0 011 1v5a1 1 0 01-1 1H2.5a1 1 0 01-1-1V4.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8 8.5l1.5-1.5 1.5 1.5M9.5 7v3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExplorerSidebar({
  width,
  activeDocumentId,
  openDocumentIds = [],
  onFileSelect,
  onCreateDocument,
  onDeleteDocument,
  onRenameDocument,
  newDocTrigger = 0,
}: ExplorerSidebarProps) {
  const { t } = useTranslation();
  const {
    projectRootPath,
    rootEntries,
    isLoading,
    selectProjectFolder,
    refreshTree,
    toggleExpand,
    isExpanded,
    getChildren,
    isSupportedFile,
  } = useProjectExplorer();

  const [selectedEntryPath, setSelectedEntryPath] = useState<string | null>(null);
  const [pointerDraggedEntryPath, setPointerDraggedEntryPath] = useState<string | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragPreviewLabel, setDragPreviewLabel] = useState("");
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ExplorerContextMenuState | null>(null);
  const [copiedFilePath, setCopiedFilePath] = useState<string | null>(null);
  const [deleteConfirmEntryPath, setDeleteConfirmEntryPath] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTreeFocused, setIsTreeFocused] = useState(false);

  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const treeNavRef = useRef<HTMLElement>(null);
  const deleteDialogCancelButtonRef = useRef<HTMLButtonElement>(null);
  const deleteDialogTitleId = useId();
  const creatingRef = useRef(false);
  const renamingRef = useRef(false);
  const toastTimeoutRef = useRef<number | null>(null);
  const pointerDragStartRef = useRef<{ path: string; label: string; x: number; y: number } | null>(null);
  const pointerDraggedEntryPathRef = useRef<string | null>(null);
  const pointerDraggedEntryLabelRef = useRef("");
  const suppressClickRef = useRef(false);
  const closeDeleteConfirmDialog = useCallback(() => {
    setDeleteConfirmEntryPath(null);
  }, []);
  const deleteDialogRef = useDialogA11y({
    isOpen: Boolean(deleteConfirmEntryPath),
    onClose: closeDeleteConfirmDialog,
    initialFocusRef: deleteDialogCancelButtonRef,
  });
  const findEntryByPath = useCallback((targetPath: string): DirEntry | null => {
    const stack = [...rootEntries];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      if (current.path === targetPath) {
        return current;
      }

      if (current.isDir) {
        const children = getChildren(current.path);
        for (let idx = children.length - 1; idx >= 0; idx -= 1) {
          stack.push(children[idx]);
        }
      }
    }

    return null;
  }, [rootEntries, getChildren]);

  const selectedEntry = useMemo(() => {
    if (!selectedEntryPath) return null;
    return findEntryByPath(selectedEntryPath);
  }, [selectedEntryPath, findEntryByPath]);

  const visibleTreeNodes = useMemo(() => {
    const nodes: Array<{ entry: DirEntry; depth: number; parentPath: string | null }> = [];

    const walk = (
      entries: DirEntry[],
      depth: number,
      parentPath: string | null
    ) => {
      for (const entry of entries) {
        nodes.push({ entry, depth, parentPath });

        if (entry.isDir && isExpanded(entry.path)) {
          walk(getChildren(entry.path), depth + 1, entry.path);
        }
      }
    };

    walk(rootEntries, 0, null);

    return nodes;
  }, [rootEntries, isExpanded, getChildren]);

  const selectedTreeItemId = useMemo(() => {
    if (!selectedEntryPath) return undefined;

    const isVisible = visibleTreeNodes.some(
      (node) => node.entry.path === selectedEntryPath,
    );

    if (!isVisible) return undefined;
    return getTreeItemDomId(selectedEntryPath);
  }, [selectedEntryPath, visibleTreeNodes]);

  const parentPathByEntry = useMemo(() => {
    const map = new Map<string, string | null>();

    const walk = (entries: DirEntry[], parentPath: string | null) => {
      for (const entry of entries) {
        map.set(entry.path, parentPath);

        if (entry.isDir) {
          const children = getChildren(entry.path);
          if (children.length > 0) {
            walk(children, entry.path);
          }
        }
      }
    };

    walk(rootEntries, null);

    return map;
  }, [rootEntries, getChildren]);

  const contextMenuEntry = useMemo(() => {
    if (!contextMenu?.entryPath) return null;
    return findEntryByPath(contextMenu.entryPath);
  }, [contextMenu, findEntryByPath]);

  const deleteConfirmEntry = useMemo(() => {
    if (!deleteConfirmEntryPath) return null;
    return findEntryByPath(deleteConfirmEntryPath);
  }, [deleteConfirmEntryPath, findEntryByPath]);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }

    setToastMessage(message);

    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const cancelCreating = useCallback(() => {
    setIsCreating(false);
    setNewFileName("");
    setCreateError(null);
    creatingRef.current = false;
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingPath(null);
    setRenameValue("");
    setRenameError(null);
    renamingRef.current = false;
  }, []);

  const startRenameForPath = useCallback((path: string) => {
    const entry = findEntryByPath(path);
    const fallbackName = path.replace(/.*[\\/]/, "");

    setSelectedEntryPath(path);
    setRenamingPath(path);
    setRenameValue(entry?.name ?? fallbackName);
    setRenameError(null);
    renamingRef.current = false;
  }, [findEntryByPath]);

  const createDocumentWithDefaultName = useCallback(async (targetDirPath: string) => {
    if (!projectRootPath) {
      throw new Error("Project root is not available");
    }

    const baseName = t("explorer_paste_default_name");

    for (let index = 0; index < 10_000; index += 1) {
      const candidateName =
        index === 0 ? `${baseName}.md` : `${baseName} (${index}).md`;
      const candidatePath = joinPath(targetDirPath, candidateName);

      try {
        return await createProjectFile(candidatePath, projectRootPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("already exists")) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("Could not generate destination file name");
  }, [projectRootPath, t]);

  const clearDragState = useCallback(() => {
    pointerDragStartRef.current = null;
    pointerDraggedEntryPathRef.current = null;
    pointerDraggedEntryLabelRef.current = "";
    setPointerDraggedEntryPath(null);
    setDragPreviewPosition(null);
    setDragPreviewLabel("");
    setDropTargetPath(null);
  }, []);

  const resolveFolderPathFromPoint = useCallback((clientX: number, clientY: number): string | null => {
    const element = document.elementFromPoint(clientX, clientY);
    if (!(element instanceof HTMLElement)) return null;

    const folderElement = element.closest<HTMLElement>("[data-drop-folder-path]");
    const folderPath = folderElement?.dataset.dropFolderPath?.trim();
    return folderPath || null;
  }, []);

  const canDropIntoFolder = useCallback((targetFolderPath: string, sourcePath?: string | null): boolean => {
    const draggedPath = sourcePath ?? pointerDraggedEntryPathRef.current ?? pointerDraggedEntryPath;
    if (!draggedPath) return false;

    const source = normalizePath(draggedPath);
    const target = normalizePath(targetFolderPath);

    if (source === target) return false;

    const sourceParent = normalizePath(getParentFolderPath(draggedPath));
    if (sourceParent === target) return false;

    const draggedEntry = findEntryByPath(draggedPath);
    if (draggedEntry?.isDir && target.startsWith(`${source}/`)) {
      return false;
    }

    return true;
  }, [pointerDraggedEntryPath, findEntryByPath]);

  const moveEntryToFolder = useCallback(async (sourcePath: string, targetFolderPath: string) => {
    if (!projectRootPath) return;

    const draggedEntry = findEntryByPath(sourcePath);

    try {
      const movedPath = await moveProjectEntry(sourcePath, targetFolderPath, projectRootPath);

      await refreshTree();
      setSelectedEntryPath(movedPath);
      setMoveError(null);

      if (
        draggedEntry &&
        !draggedEntry.isDir &&
        activeDocumentId === sourcePath &&
        movedPath !== sourcePath &&
        isSupportedFile(movedPath)
      ) {
        onFileSelect(movedPath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already exists")) {
        setMoveError(t("explorer_error_move_exists"));
      } else {
        setMoveError(t("explorer_error_move"));
      }
    }
  }, [projectRootPath, findEntryByPath, refreshTree, activeDocumentId, isSupportedFile, onFileSelect, t]);

  const openContextMenuForEntry = useCallback((event: ReactMouseEvent<HTMLElement>, entry: DirEntry) => {
    if (renamingPath) return;

    event.preventDefault();
    event.stopPropagation();

    setSelectedEntryPath(entry.path);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      entryPath: entry.path,
      targetDirPath: entry.isDir ? entry.path : getParentFolderPath(entry.path),
    });
  }, [renamingPath]);

  const openContextMenuForRoot = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!projectRootPath) return;

    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      entryPath: null,
      targetDirPath: projectRootPath,
    });
  }, [projectRootPath]);

  const handleOpenFromContextMenu = useCallback(() => {
    if (!contextMenuEntry || contextMenuEntry.isDir) return;

    if (!isSupportedFile(contextMenuEntry.path)) return;

    onFileSelect(contextMenuEntry.path);
    setSelectedEntryPath(contextMenuEntry.path);
    setContextMenu(null);
    setMoveError(null);
  }, [contextMenuEntry, isSupportedFile, onFileSelect]);

  const handleRefreshFromContextMenu = useCallback(async () => {
    setContextMenu(null);
    setMoveError(null);

    try {
      await refreshTree();
    } catch {
      setMoveError(t("explorer_error_refresh"));
    }
  }, [refreshTree, t]);

  const handleOpenInFileExplorerFromContextMenu = useCallback(async () => {
    const targetPath = contextMenuEntry?.path ?? projectRootPath;
    if (!targetPath) return;

    setContextMenu(null);
    setMoveError(null);

    try {
      await openInFileExplorer(targetPath, projectRootPath);
    } catch {
      setMoveError(t("explorer_error_open_in_explorer"));
    }
  }, [contextMenuEntry, projectRootPath, t]);

  const handleRenameFromContextMenu = useCallback(() => {
    if (!contextMenuEntry) return;

    setContextMenu(null);
    startRenameForPath(contextMenuEntry.path);
  }, [contextMenuEntry, startRenameForPath]);

  const handleCopyFromContextMenu = useCallback(() => {
    if (!contextMenuEntry || contextMenuEntry.isDir) return;

    setCopiedFilePath(contextMenuEntry.path);
    setContextMenu(null);
    setMoveError(null);
    showToast(t("explorer_copy_success"));
  }, [contextMenuEntry, showToast, t]);

  const handlePasteFromContextMenu = useCallback(async () => {
    if (!projectRootPath || !copiedFilePath || !contextMenu?.targetDirPath) return;

    setContextMenu(null);
    setCopiedFilePath(null);

    try {
      const pastedPath = await pasteCopiedProjectFile(
        copiedFilePath,
        contextMenu.targetDirPath,
        projectRootPath,
        t("explorer_paste_default_name")
      );

      await refreshTree();
      setSelectedEntryPath(pastedPath);
      setMoveError(null);
      showToast(t("explorer_paste_success"));

      if (isSupportedFile(pastedPath)) {
        onFileSelect(pastedPath);
      }
    } catch {
      setMoveError(t("explorer_error_paste"));
    }
  }, [projectRootPath, copiedFilePath, contextMenu, refreshTree, t, isSupportedFile, onFileSelect, showToast]);

  const handleCreateDocumentFromContextMenu = useCallback(async () => {
    if (!projectRootPath || !contextMenu?.targetDirPath) return;

    setContextMenu(null);
    setMoveError(null);

    try {
      const createdPath = await createDocumentWithDefaultName(contextMenu.targetDirPath);
      await refreshTree();
      setMoveError(null);

      setTimeout(() => {
        startRenameForPath(createdPath);
      }, 0);
    } catch {
      setMoveError(t("explorer_error_create"));
    }
  }, [projectRootPath, contextMenu, createDocumentWithDefaultName, refreshTree, startRenameForPath, t]);

  const handleCreateFolderFromContextMenu = useCallback(async () => {
    if (!projectRootPath || !contextMenu?.targetDirPath) return;

    setContextMenu(null);
    setMoveError(null);

    try {
      const createdFolderPath = await createProjectFolder(
        contextMenu.targetDirPath,
        projectRootPath,
        t("explorer_folder_default_name")
      );

      await refreshTree();
      setMoveError(null);

      setTimeout(() => {
        startRenameForPath(createdFolderPath);
      }, 0);
    } catch {
      setMoveError(t("explorer_error_create_folder"));
    }
  }, [projectRootPath, contextMenu, refreshTree, startRenameForPath, t]);

  const handleRequestDeleteFromContextMenu = useCallback(() => {
    if (!contextMenuEntry) return;

    setContextMenu(null);
    setDeleteConfirmEntryPath(contextMenuEntry.path);
  }, [contextMenuEntry]);

  const handleConfirmDelete = useCallback(async () => {
    if (!projectRootPath || !deleteConfirmEntry) {
      setDeleteConfirmEntryPath(null);
      return;
    }

    const deletedPath = deleteConfirmEntry.path;

    setDeleteConfirmEntryPath(null);

    try {
      await deleteProjectEntry(deletedPath, projectRootPath);
      await refreshTree();

      const deletedPathNorm = normalizePath(deletedPath);
      const selectedPathNorm = selectedEntryPath ? normalizePath(selectedEntryPath) : null;
      if (selectedPathNorm === deletedPathNorm || selectedPathNorm?.startsWith(`${deletedPathNorm}/`)) {
        setSelectedEntryPath(null);
      }

      if (!deleteConfirmEntry.isDir) {
        onDeleteDocument?.(deletedPath);
      }

      setMoveError(null);
      showToast(t("explorer_delete_success"));
    } catch {
      setMoveError(t("explorer_error_delete"));
    }
  }, [projectRootPath, deleteConfirmEntry, refreshTree, selectedEntryPath, onDeleteDocument, showToast, t]);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && contextMenuRef.current?.contains(target)) {
        return;
      }
      setContextMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  const handlePointerDownOnEntry = useCallback((event: ReactPointerEvent<HTMLElement>, entry: DirEntry) => {
    if (renamingPath || contextMenu || entry.isDir || event.button !== 0) return;

    pointerDragStartRef.current = {
      path: entry.path,
      label: entry.name,
      x: event.clientX,
      y: event.clientY,
    };
    suppressClickRef.current = false;
  }, [renamingPath, contextMenu]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const start = pointerDragStartRef.current;

      if (start && !pointerDraggedEntryPathRef.current) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;

        if (Math.hypot(dx, dy) >= 6) {
          pointerDragStartRef.current = null;
          suppressClickRef.current = true;

          pointerDraggedEntryPathRef.current = start.path;
          pointerDraggedEntryLabelRef.current = start.label;
          setPointerDraggedEntryPath(start.path);
          setDragPreviewLabel(start.label);
          setDragPreviewPosition({ x: event.clientX, y: event.clientY });
          setSelectedEntryPath(start.path);
          setMoveError(null);
        }
      }

      const sourcePath = pointerDraggedEntryPathRef.current ?? pointerDraggedEntryPath;
      if (!sourcePath) return;
      setDragPreviewPosition({ x: event.clientX, y: event.clientY });

      const hoveredFolderPath = resolveFolderPathFromPoint(event.clientX, event.clientY);
      if (hoveredFolderPath && canDropIntoFolder(hoveredFolderPath, sourcePath)) {
        if (dropTargetPath !== hoveredFolderPath) {
          setDropTargetPath(hoveredFolderPath);
        }
      } else if (dropTargetPath !== null) {
        setDropTargetPath(null);
      }
    };

    const finishPointerDrag = () => {
      pointerDragStartRef.current = null;

      const sourcePath = pointerDraggedEntryPathRef.current ?? pointerDraggedEntryPath;
      const targetFolderPath = sourcePath ? dropTargetPath : null;

      clearDragState();

      if (sourcePath && targetFolderPath && canDropIntoFolder(targetFolderPath, sourcePath)) {
        void moveEntryToFolder(sourcePath, targetFolderPath);
      }

      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishPointerDrag);
    window.addEventListener("pointercancel", finishPointerDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointerDrag);
      window.removeEventListener("pointercancel", finishPointerDrag);
    };
  }, [pointerDraggedEntryPath, dropTargetPath, resolveFolderPathFromPoint, canDropIntoFolder, moveEntryToFolder, clearDragState]);
  const startCreating = useCallback(() => {
    if (!projectRootPath) return;

    cancelRename();
    setMoveError(null);
    setIsCreating(true);
    setNewFileName("");
    setCreateError(null);

    setTimeout(() => {
      createInputRef.current?.focus();
    }, 0);
  }, [projectRootPath, cancelRename]);

  useEffect(() => {
    if (newDocTrigger > 0) {
      startCreating();
    }
  }, [newDocTrigger, startCreating]);

  useEffect(() => {
    if (!renamingPath) return;
    const renamingEntry = findEntryByPath(renamingPath);
    const preserveExtension = Boolean(renamingEntry && !renamingEntry.isDir);

    let cancelled = false;
    let attempts = 0;

    const focusRenameInput = () => {
      if (cancelled) return;

      if (renameInputRef.current) {
        const input = renameInputRef.current;
        input.focus();

        const selectionEnd = preserveExtension
          ? getRenameSelectionEnd(input.value)
          : input.value.length;
        input.setSelectionRange(0, selectionEnd);
        return;
      }

      if (attempts < 12) {
        attempts += 1;
        requestAnimationFrame(focusRenameInput);
      }
    };

    requestAnimationFrame(focusRenameInput);

    return () => {
      cancelled = true;
    };
  }, [renamingPath, findEntryByPath]);

  useEffect(() => {
    if (!selectedEntryPath) return;
    if (findEntryByPath(selectedEntryPath)) return;

    setSelectedEntryPath(null);
  }, [selectedEntryPath, findEntryByPath]);

  useEffect(() => {
    if (!selectedEntryPath) return;

    const container = treeNavRef.current;
    if (!container) return;

    const rows = container.querySelectorAll<HTMLElement>("[data-tree-entry-path]");

    for (const row of rows) {
      if (row.dataset.treeEntryPath === selectedEntryPath) {
        row.scrollIntoView({ block: "nearest" });
        break;
      }
    }
  }, [selectedEntryPath, visibleTreeNodes]);

  const submitNewFile = useCallback(async () => {
    const trimmed = newFileName.trim();
    if (!trimmed) {
      setCreateError(t("explorer_error_empty"));
      return;
    }

    if (hasInvalidFilenameChars(trimmed)) {
      setCreateError(t("explorer_error_invalid"));
      return;
    }

    if (!projectRootPath) return;

    creatingRef.current = true;

    const targetDir = selectedEntry
      ? selectedEntry.isDir
        ? selectedEntry.path
        : getParentFolderPath(selectedEntry.path)
      : projectRootPath;

    const separator = targetDir.includes("\\") ? "\\" : "/";
    const fileName = /\.\w+$/.test(trimmed) ? trimmed : `${trimmed}.md`;
    const fullPath = `${targetDir}${separator}${fileName}`;

    try {
      const createdPath = await createProjectFile(fullPath, projectRootPath);
      cancelCreating();
      await refreshTree();
      setSelectedEntryPath(createdPath);
      onCreateDocument?.(createdPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already exists")) {
        setCreateError(t("explorer_error_exists"));
      } else {
        setCreateError(t("explorer_error_create"));
      }
    } finally {
      creatingRef.current = false;
    }
  }, [newFileName, projectRootPath, selectedEntry, cancelCreating, refreshTree, onCreateDocument, t]);

  const beginRename = useCallback((entry: DirEntry) => {
    cancelCreating();
    setMoveError(null);
    setSelectedEntryPath(entry.path);
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
    setRenameError(null);
  }, [cancelCreating]);

  const submitRename = useCallback(async () => {
    if (!renamingPath || !projectRootPath) return;

    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError(t("explorer_error_empty"));
      return;
    }

    if (trimmed === "." || trimmed === ".." || hasInvalidFilenameChars(trimmed)) {
      setRenameError(t("explorer_error_rename_invalid"));
      return;
    }

    const entry = findEntryByPath(renamingPath);
    if (!entry) {
      cancelRename();
      return;
    }

    if (trimmed === entry.name) {
      cancelRename();
      return;
    }

    renamingRef.current = true;

    try {
      const renamedPath = await renameProjectEntry(renamingPath, trimmed, projectRootPath);
      cancelRename();
      await refreshTree();
      setSelectedEntryPath(renamedPath);
      if (!entry.isDir) {
        onRenameDocument?.(renamingPath, renamedPath);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already exists")) {
        setRenameError(t("explorer_error_rename_exists"));
      } else if (message.includes("Invalid name")) {
        setRenameError(t("explorer_error_rename_invalid"));
      } else {
        setRenameError(t("explorer_error_rename"));
      }
    } finally {
      renamingRef.current = false;
    }
  }, [renamingPath, projectRootPath, renameValue, findEntryByPath, cancelRename, refreshTree, onRenameDocument, t]);

  const handleEntryClick = useCallback((entry: DirEntry) => {
    treeNavRef.current?.focus();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (renamingPath) return;

    setSelectedEntryPath(entry.path);

    if (entry.isDir) {
      void toggleExpand(entry.path);
    }
  }, [renamingPath, toggleExpand]);

  const handleEntryOpen = useCallback((entry: DirEntry) => {
    treeNavRef.current?.focus();
    if (renamingPath) return;

    if (entry.isDir) {
      void toggleExpand(entry.path);
      return;
    }

    if (isSupportedFile(entry.path)) {
      onFileSelect(entry.path);
    }
  }, [renamingPath, toggleExpand, isSupportedFile, onFileSelect]);

  const handleExplorerKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (isTextInputTarget(event.target)) return;

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowLeft" ||
      event.key === "Enter" ||
      event.key === "F2"
    ) {
      treeNavRef.current?.focus();
    }

    if (event.key === "Escape" && contextMenu) {
      event.preventDefault();
      setContextMenu(null);
      return;
    }

    if (event.key === "F2") {
      if (isCreating || renamingPath || !selectedEntry) return;

      event.preventDefault();
      beginRename(selectedEntry);
      return;
    }

    if (event.key === "Enter") {
      if (isCreating || renamingPath || !selectedEntry) return;

      event.preventDefault();
      handleEntryOpen(selectedEntry);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (isCreating || renamingPath || visibleTreeNodes.length === 0) return;

      event.preventDefault();

      const currentIndex = selectedEntryPath
        ? visibleTreeNodes.findIndex((node) => node.entry.path === selectedEntryPath)
        : -1;
      const direction = event.key === "ArrowDown" ? 1 : -1;

      const nextIndex =
        currentIndex === -1
          ? direction > 0
            ? 0
            : visibleTreeNodes.length - 1
          : clamp(currentIndex + direction, 0, visibleTreeNodes.length - 1);

      const nextPath = visibleTreeNodes[nextIndex]?.entry.path;
      if (nextPath) {
        setSelectedEntryPath(nextPath);
      }
      return;
    }

    if (event.key === "ArrowRight") {
      if (isCreating || renamingPath) return;

      if (!selectedEntry) {
        if (visibleTreeNodes.length > 0) {
          event.preventDefault();
          setSelectedEntryPath(visibleTreeNodes[0].entry.path);
        }
        return;
      }

      if (selectedEntry.isDir) {
        event.preventDefault();

        if (!isExpanded(selectedEntry.path)) {
          void toggleExpand(selectedEntry.path);
          return;
        }

        const children = getChildren(selectedEntry.path);
        if (children.length > 0) {
          setSelectedEntryPath(children[0].path);
        }
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      if (isCreating || renamingPath || !selectedEntry) return;

      if (selectedEntry.isDir && isExpanded(selectedEntry.path)) {
        event.preventDefault();
        void toggleExpand(selectedEntry.path);
        return;
      }

      const parentPath = parentPathByEntry.get(selectedEntry.path);
      if (parentPath) {
        event.preventDefault();
        setSelectedEntryPath(parentPath);
      }
    }
  }, [
    isCreating,
    renamingPath,
    selectedEntry,
    selectedEntryPath,
    beginRename,
    handleEntryOpen,
    isExpanded,
    toggleExpand,
    contextMenu,
    visibleTreeNodes,
    getChildren,
    parentPathByEntry,
  ]);

  const renderTreeNode = useCallback((entry: DirEntry, depth: number) => {
    const expanded = entry.isDir ? isExpanded(entry.path) : false;
    const children = entry.isDir ? getChildren(entry.path) : [];
    const supported = entry.isDir || isSupportedFile(entry.path);
    const isSelected = selectedEntryPath === entry.path;
    const isActiveDocument = activeDocumentId === entry.path;
    const isRenaming = renamingPath === entry.path;
    const treeItemId = getTreeItemDomId(entry.path);

    const isDropTarget = entry.isDir && dropTargetPath === entry.path && canDropIntoFolder(entry.path);

    return (
      <div key={entry.path} role="none">
        <div
          id={treeItemId}
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={entry.isDir ? expanded : undefined}
          aria-selected={isSelected}
          aria-disabled={!supported || undefined}
          data-tree-entry-path={entry.path}
          data-drop-folder-path={entry.isDir ? entry.path : undefined}
          onContextMenu={(event) => openContextMenuForEntry(event, entry)}
          className={`flex items-center gap-1 rounded transition-colors ${isDropTarget ? "bg-[var(--app-surface-alt)]/80 ring-1 ring-[var(--app-border)]" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          {entry.isDir ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                treeNavRef.current?.focus();
                void toggleExpand(entry.path);
              }}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--app-text-muted)] outline-none transition-[color,transform] duration-[160ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[var(--app-text)] focus:outline-none focus-visible:outline-none ${expanded ? "rotate-90" : "rotate-0"}`}
              aria-label={expanded ? "Collapse folder" : "Expand folder"}
              title={expanded ? "Collapse folder" : "Expand folder"}
              tabIndex={-1}
            >
              <IconChevronRight />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {isRenaming ? (
            <div className="my-px flex-1 rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1">
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(event) => {
                  setRenameValue(event.target.value);
                  setRenameError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitRename();
                  } else if (event.key === "Escape") {
                    cancelRename();
                  }
                }}
                onBlur={() => {
                  if (!renamingRef.current) {
                    cancelRename();
                  }
                }}
                placeholder={t("explorer_rename_placeholder")}
                className="w-full bg-transparent text-[length:var(--ui-fs)] text-[var(--app-text)] outline-none"
              />
              {renameError && (
                <p className="mt-0.5 text-[10px] text-red-400/80">{renameError}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleEntryClick(entry)}
              onDoubleClick={() => {
                if (!entry.isDir) {
                  handleEntryOpen(entry);
                }
              }}
              onPointerDown={!entry.isDir ? (event) => handlePointerDownOnEntry(event, entry) : undefined}
              title={!supported ? t("explorer_unsupported") : undefined}
              tabIndex={-1}
              className={`my-px flex flex-1 items-center gap-2 rounded px-2 py-[5px] text-left text-[length:var(--ui-fs)] outline-none transition-colors focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${
                isSelected
                  ? `bg-[var(--app-surface-alt)] text-[var(--app-text)] ${isTreeFocused ? "ring-1 ring-[var(--app-border)]" : ""}`
                  : isActiveDocument
                    ? "bg-[var(--app-surface-alt)]/60 text-[var(--app-text)]"
                    : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
              } ${!supported ? "opacity-50" : ""}`}
            >
              <span className={`shrink-0 ${entry.isDir ? "text-[var(--app-text-muted)]" : "text-[var(--app-text-muted)]/70"}`}>
                {entry.isDir ? <IconFolder open={expanded} /> : <IconFile />}
              </span>
              <span className="truncate">{entry.name}</span>
            </button>
          )}
        </div>
        {entry.isDir && (
          <div
            role="group"
            style={{
              display: "grid",
              gridTemplateRows: expanded ? "1fr" : "0fr",
              transition: "grid-template-rows 200ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <div style={{ overflow: "hidden" }}>
              {children.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  }, [isExpanded, getChildren, isSupportedFile, selectedEntryPath, activeDocumentId, renamingPath, renameValue, renameError, dropTargetPath, t, submitRename, cancelRename, handleEntryClick, handleEntryOpen, toggleExpand, handlePointerDownOnEntry, canDropIntoFolder, openContextMenuForEntry, isTreeFocused]);

  const contextMenuKind = useMemo<"workspace" | "file" | "folder" | null>(() => {
    if (!contextMenu) return null;
    if (!contextMenu.entryPath) return "workspace";
    if (!contextMenuEntry) return null;
    return contextMenuEntry.isDir ? "folder" : "file";
  }, [contextMenu, contextMenuEntry]);

  const contextMenuPosition = useMemo(() => {
    if (!contextMenu) return null;

    const menuWidth = 220;
    const menuHeight =
      contextMenuKind === "file"
        ? 286
        : contextMenuKind === "folder"
          ? 338
          : 248;
    const pad = 8;

    const maxX = Math.max(pad, window.innerWidth - menuWidth - pad);
    const maxY = Math.max(pad, window.innerHeight - menuHeight - pad);

    return {
      x: clamp(contextMenu.x, pad, maxX),
      y: clamp(contextMenu.y, pad, maxY),
    };
  }, [contextMenu, contextMenuKind]);

  const contextFilePath =
    contextMenuKind === "file" && contextMenuEntry && !contextMenuEntry.isDir
      ? contextMenuEntry.path
      : null;
  const isContextFileOpen = Boolean(
    contextFilePath &&
      openDocumentIds.some((openPath) => normalizePath(openPath) === normalizePath(contextFilePath))
  );
  const canOpenFromContext = Boolean(contextFilePath && isSupportedFile(contextFilePath) && !isContextFileOpen);
  const canRenameFromContext = Boolean(
    contextMenuEntry && (contextMenuKind === "file" || contextMenuKind === "folder")
  );
  const canCopyFromContext = Boolean(contextMenuKind === "file" && contextMenuEntry && !contextMenuEntry.isDir);
  const canPasteFromContext = Boolean(
    projectRootPath &&
      copiedFilePath &&
      contextMenu?.targetDirPath &&
      (contextMenuKind === "workspace" || contextMenuKind === "folder")
  );
  const canCreateDocumentFromContext = Boolean(
    projectRootPath &&
      contextMenu?.targetDirPath &&
      (contextMenuKind === "workspace" || contextMenuKind === "folder")
  );
  const canCreateFolderFromContext = Boolean(
    projectRootPath &&
      contextMenu?.targetDirPath &&
      (contextMenuKind === "workspace" || contextMenuKind === "folder")
  );
  const canDeleteFromContext = Boolean(
    contextMenuKind === "file" || contextMenuKind === "folder"
  );
  const canOpenInExplorerFromContext = Boolean(
    (contextMenuEntry?.path ?? projectRootPath) &&
      (contextMenuKind === "workspace" ||
        contextMenuKind === "file" ||
        contextMenuKind === "folder")
  );

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-bg)] outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ${pointerDraggedEntryPath ? "select-none cursor-grabbing" : ""}`}
      style={{ width }}
    >
      <div
        className="flex items-center border-b border-[var(--app-border)] px-3"
        style={{ minHeight: 32 }}
      >
        <span className="text-[length:var(--ui-fs-sm)] font-semibold tracking-[0.12em] uppercase text-[var(--app-text-muted)]">
          {t("explorer_title")}
        </span>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {!projectRootPath ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6">
            <p className="text-center text-sm text-[var(--app-text-muted)]">
              {t("explorer_select_folder")}
            </p>
            <button
              type="button"
              onClick={selectProjectFolder}
              disabled={isLoading}
              className="rounded-md bg-[var(--app-surface-alt)] px-4 py-2 text-sm font-medium text-[var(--app-text)] transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {t("explorer_select_btn")}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)] px-3 py-1.5">
              <span
                data-drop-folder-path={projectRootPath}
                onContextMenu={openContextMenuForRoot}
                className={`truncate text-[length:var(--ui-fs)] font-medium text-[var(--app-text)]/80 ${dropTargetPath === projectRootPath ? "rounded bg-[var(--app-surface-alt)]/80 px-1 ring-1 ring-[var(--app-border)]" : ""}`}
                title={projectRootPath}
              >
                {getFolderName(projectRootPath)}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => void refreshTree()}
                  disabled={isLoading}
                  className="flex h-6 w-6 items-center justify-center rounded text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)] disabled:opacity-40 disabled:hover:bg-transparent"
                  title={t("explorer_refresh")}
                  aria-label={t("explorer_refresh")}
                >
                  <IconRefreshSm />
                </button>
                <button
                  type="button"
                  onClick={selectProjectFolder}
                  className="flex h-6 w-6 items-center justify-center rounded text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  title={t("explorer_change_folder")}
                  aria-label={t("explorer_change_folder")}
                >
                  <IconChangeFolderSm />
                </button>
              </div>
            </div>

            <nav
              ref={treeNavRef}
              role="tree"
              aria-label={t("explorer_title")}
              aria-activedescendant={selectedTreeItemId}
              aria-multiselectable={false}
              tabIndex={0}
              className="flex-1 overflow-y-auto px-2 py-2 outline-none focus:outline-none focus-visible:outline-none"
              onKeyDown={handleExplorerKeyDown}
              onFocus={() => setIsTreeFocused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsTreeFocused(false);
                }
              }}
              onContextMenu={(event) => {
                if (isTextInputTarget(event.target)) return;
                openContextMenuForRoot(event);
              }}
            >
              {isCreating && (
                <div className="mb-2 px-2">
                  <input
                    ref={createInputRef}
                    type="text"
                    value={newFileName}
                    onChange={(event) => {
                      setNewFileName(event.target.value);
                      setCreateError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitNewFile();
                      } else if (event.key === "Escape") {
                        cancelCreating();
                      }
                    }}
                    onBlur={() => {
                      if (!creatingRef.current) {
                        cancelCreating();
                      }
                    }}
                    placeholder={t("explorer_doc_name_placeholder")}
                    className="w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/60 outline-none focus:border-[var(--app-surface-alt)]"
                  />
                  {createError && (
                    <p className="mt-0.5 text-[10px] text-red-400/80">{createError}</p>
                  )}
                </div>
              )}

              {moveError && (
                <p className="mb-2 px-2 text-[10px] text-red-400/80">{moveError}</p>
              )}

              {rootEntries.map((entry) => renderTreeNode(entry, 0))}

              {rootEntries.length === 0 && !isCreating && (
                <p className="px-2 py-1 text-xs text-[var(--app-text-muted)]/80">
                  {t("explorer_folder_empty")}
                </p>
              )}
            </nav>
          </>
        )}
      </div>

      {pointerDraggedEntryPath && dragPreviewPosition && (
        <div
          className="pointer-events-none fixed z-[120] rounded-md border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm"
          style={{ left: dragPreviewPosition.x + 12, top: dragPreviewPosition.y + 10 }}
        >
          <div className="flex items-center gap-2 text-[length:var(--ui-fs-sm)] text-[var(--app-text)]">
            <span className="text-[var(--app-text-muted)]/70"><IconFile /></span>
            <span className="max-w-56 truncate">{dragPreviewLabel || pointerDraggedEntryLabelRef.current}</span>
          </div>
        </div>
      )}

      {contextMenu && contextMenuPosition && (
        <div
          ref={contextMenuRef}
          className="fixed z-[200] min-w-[210px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] py-1 shadow-2xl"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          role="menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {contextMenuKind === "workspace" && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleRefreshFromContextMenu()}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)]"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconRefreshSm /></span>
                <span className="flex-1">{t("explorer_context_refresh")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleOpenInFileExplorerFromContextMenu()}
                disabled={!canOpenInExplorerFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconExternalFolder /></span>
                <span className="flex-1">{t("explorer_context_open_in_explorer")}</span>
              </button>
              <div className="my-1 mx-2 h-px bg-[var(--app-border)]/60" />
              <button
                type="button"
                role="menuitem"
                onClick={() => void handlePasteFromContextMenu()}
                disabled={!canPasteFromContext}
                title={!canPasteFromContext ? t("explorer_context_paste_disabled") : undefined}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconPaste /></span>
                <span className="flex-1">{t("explorer_context_paste")}</span>
              </button>
              <div className="my-1 mx-2 h-px bg-[var(--app-border)]/60" />
              <button
                type="button"
                role="menuitem"
                onClick={handleCreateDocumentFromContextMenu}
                disabled={!canCreateDocumentFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconNewDoc /></span>
                <span className="flex-1">{t("explorer_new_doc")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCreateFolderFromContextMenu()}
                disabled={!canCreateFolderFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconNewFolder /></span>
                <span className="flex-1">{t("explorer_context_new_folder")}</span>
              </button>
            </>
          )}

          {contextMenuKind === "file" && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleRefreshFromContextMenu()}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)]"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconRefreshSm /></span>
                <span className="flex-1">{t("explorer_context_refresh")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleOpenInFileExplorerFromContextMenu()}
                disabled={!canOpenInExplorerFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconExternalFolder /></span>
                <span className="flex-1">{t("explorer_context_open_in_explorer")}</span>
              </button>
              <div className="my-1 mx-2 h-px bg-[var(--app-border)]/60" />
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenFromContextMenu}
                disabled={!canOpenFromContext}
                title={!canOpenFromContext ? t("explorer_context_open_disabled") : undefined}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconOpen /></span>
                <span className="flex-1">{t("explorer_context_open")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleRenameFromContextMenu}
                disabled={!canRenameFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconRename /></span>
                <span className="flex-1">{t("explorer_context_rename")}</span>
                <span className="ml-4 text-[length:var(--ui-fs-sm)] text-[var(--app-text-muted)]/50">F2</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleCopyFromContextMenu}
                disabled={!canCopyFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconCopy /></span>
                <span className="flex-1">{t("explorer_context_copy")}</span>
              </button>
              <div className="my-1 mx-2 h-px bg-[var(--app-border)]/60" />
              <button
                type="button"
                role="menuitem"
                onClick={handleRequestDeleteFromContextMenu}
                disabled={!canDeleteFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-red-500 transition-colors hover:bg-red-500/8 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center"><IconTrash /></span>
                <span className="flex-1">{t("explorer_context_delete")}</span>
                <span className="ml-4 text-[length:var(--ui-fs-sm)] text-red-400/50">Del</span>
              </button>
            </>
          )}

          {contextMenuKind === "folder" && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleRefreshFromContextMenu()}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)]"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconRefreshSm /></span>
                <span className="flex-1">{t("explorer_context_refresh")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleOpenInFileExplorerFromContextMenu()}
                disabled={!canOpenInExplorerFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconExternalFolder /></span>
                <span className="flex-1">{t("explorer_context_open_in_explorer")}</span>
              </button>
              <div className="my-1 mx-2 h-px bg-[var(--app-border)]/60" />
              <button
                type="button"
                role="menuitem"
                onClick={() => void handlePasteFromContextMenu()}
                disabled={!canPasteFromContext}
                title={!canPasteFromContext ? t("explorer_context_paste_disabled") : undefined}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconPaste /></span>
                <span className="flex-1">{t("explorer_context_paste")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleRenameFromContextMenu}
                disabled={!canRenameFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconRename /></span>
                <span className="flex-1">{t("explorer_context_rename")}</span>
                <span className="ml-4 text-[length:var(--ui-fs-sm)] text-[var(--app-text-muted)]/50">F2</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleRequestDeleteFromContextMenu}
                disabled={!canDeleteFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-red-500 transition-colors hover:bg-red-500/8 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center"><IconTrash /></span>
                <span className="flex-1">{t("explorer_context_delete")}</span>
                <span className="ml-4 text-[length:var(--ui-fs-sm)] text-red-400/50">Del</span>
              </button>
              <div className="my-1 mx-2 h-px bg-[var(--app-border)]/60" />
              <button
                type="button"
                role="menuitem"
                onClick={handleCreateDocumentFromContextMenu}
                disabled={!canCreateDocumentFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconNewDoc /></span>
                <span className="flex-1">{t("explorer_new_doc")}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleCreateFolderFromContextMenu()}
                disabled={!canCreateFolderFromContext}
                className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[length:var(--ui-fs)] text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-[var(--app-text-muted)]"><IconNewFolder /></span>
                <span className="flex-1">{t("explorer_context_new_folder")}</span>
              </button>
            </>
          )}
        </div>
      )}

      {deleteConfirmEntry && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
          onClick={closeDeleteConfirmDialog}
        >
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={deleteDialogTitleId}
            tabIndex={-1}
            className="w-full max-w-md rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id={deleteDialogTitleId} className="text-base font-semibold text-[var(--app-text)]">{t("explorer_delete_title")}</h3>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {t("explorer_delete_message")} <strong className="text-[var(--app-text)]">{deleteConfirmEntry.name}</strong>?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                ref={deleteDialogCancelButtonRef}
                type="button"
                onClick={closeDeleteConfirmDialog}
                className="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
              >
                {t("explorer_delete_cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-400"
              >
                {t("explorer_delete_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[220] -translate-x-1/2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-4 py-2 text-xs font-medium text-[var(--app-text)] shadow-lg backdrop-blur-sm">
          {toastMessage}
        </div>
      )}
    </aside>
  );
}

