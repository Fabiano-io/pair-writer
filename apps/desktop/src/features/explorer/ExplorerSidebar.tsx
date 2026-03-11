import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectExplorer } from "./useProjectExplorer";
import { createProjectFile } from "../project/projectAccess";
import type { DirEntry } from "../project/projectAccess";

interface ExplorerSidebarProps {
  width: number;
  activeDocumentId: string | null;
  onFileSelect: (path: string) => void;
  onCreateDocument?: (filePath: string) => void;
  newDocTrigger?: number;
}

function getFolderName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

function TreeNode({
  entry,
  depth,
  isExpanded,
  getChildren,
  onToggleExpand,
  onFileSelect,
  isSupportedFile,
  activeDocumentId,
}: {
  entry: DirEntry;
  depth: number;
  isExpanded: (path: string) => boolean;
  getChildren: (path: string) => DirEntry[];
  onToggleExpand: (path: string) => void;
  onFileSelect: (path: string) => void;
  isSupportedFile: (path: string) => boolean;
  activeDocumentId: string | null;
}) {
  const expanded = isExpanded(entry.path);
  const children = getChildren(entry.path);
  const supported = entry.isDir || isSupportedFile(entry.path);
  const isActive = entry.path === activeDocumentId;

  if (entry.isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggleExpand(entry.path)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          <span className="shrink-0 text-xs">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="shrink-0 text-xs opacity-60">📁</span>
          <span className="truncate">{entry.name}</span>
        </button>
        {expanded && (
          <div>
            {children.map((child) => (
              <TreeNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                isExpanded={isExpanded}
                getChildren={getChildren}
                onToggleExpand={onToggleExpand}
                onFileSelect={onFileSelect}
                isSupportedFile={isSupportedFile}
                activeDocumentId={activeDocumentId}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (supported) {
    return (
      <button
        type="button"
        onClick={() => onFileSelect(entry.path)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
          isActive
            ? "bg-zinc-800/70 text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className="shrink-0 text-xs opacity-60">📄</span>
        <span className="truncate">{entry.name}</span>
      </button>
    );
  }

  return (
    <div
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-600"
      style={{ paddingLeft: 8 + depth * 12 }}
      title="File type not supported"
    >
      <span className="shrink-0 text-xs opacity-40">📄</span>
      <span className="truncate">{entry.name}</span>
    </div>
  );
}

export function ExplorerSidebar({
  width,
  activeDocumentId,
  onFileSelect,
  onCreateDocument,
  newDocTrigger = 0,
}: ExplorerSidebarProps) {
  const {
    projectRootPath,
    rootEntries,
    isLoading,
    selectProjectFolder,
    refreshRoot,
    toggleExpand,
    isExpanded,
    getChildren,
    isSupportedFile,
  } = useProjectExplorer();

  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const startCreating = useCallback(() => {
    if (!projectRootPath) return;
    setIsCreating(true);
    setNewFileName("");
    setCreateError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [projectRootPath]);

  useEffect(() => {
    if (newDocTrigger > 0) startCreating();
  }, [newDocTrigger, startCreating]);

  const cancelCreating = useCallback(() => {
    setIsCreating(false);
    setNewFileName("");
    setCreateError(null);
  }, []);

  const submitNewFile = useCallback(async () => {
    const trimmed = newFileName.trim();
    if (!trimmed) {
      setCreateError("Name cannot be empty");
      return;
    }

    if (INVALID_FILENAME_CHARS.test(trimmed)) {
      setCreateError("Name contains invalid characters");
      return;
    }

    if (!projectRootPath) return;

    submittingRef.current = true;
    const separator = projectRootPath.includes("\\") ? "\\" : "/";
    const fileName = /\.\w+$/.test(trimmed) ? trimmed : `${trimmed}.md`;
    const fullPath = `${projectRootPath}${separator}${fileName}`;

    try {
      const createdPath = await createProjectFile(fullPath, projectRootPath);
      setIsCreating(false);
      setNewFileName("");
      setCreateError(null);
      await refreshRoot();
      onCreateDocument?.(createdPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (message.includes("already exists")) {
        setCreateError("File already exists");
      } else {
        setCreateError("Failed to create file");
      }
    } finally {
      submittingRef.current = false;
    }
  }, [newFileName, projectRootPath, refreshRoot, onCreateDocument]);

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950"
      style={{ width }}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="text-base">✦</span>
        <span className="text-sm font-semibold tracking-wide text-zinc-200">
          Pair Writer
        </span>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {!projectRootPath ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6">
            <p className="text-center text-sm text-zinc-500">
              Select a project folder to browse files
            </p>
            <button
              type="button"
              onClick={selectProjectFolder}
              disabled={isLoading}
              className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              Select project folder
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
              <span
                className="truncate text-xs text-zinc-400"
                title={projectRootPath}
              >
                {getFolderName(projectRootPath)}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={startCreating}
                  className="text-sm text-zinc-500 hover:text-zinc-300"
                  title="New document"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={selectProjectFolder}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                  title="Change project folder"
                >
                  Change
                </button>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-2">
              {isCreating && (
                <div className="mb-1 px-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newFileName}
                    onChange={(e) => {
                      setNewFileName(e.target.value);
                      setCreateError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitNewFile();
                      } else if (e.key === "Escape") {
                        cancelCreating();
                      }
                    }}
                    onBlur={() => {
                      if (!submittingRef.current) cancelCreating();
                    }}
                    placeholder="Document name..."
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
                  />
                  {createError && (
                    <p className="mt-0.5 text-[10px] text-red-400/80">
                      {createError}
                    </p>
                  )}
                </div>
              )}

              {rootEntries.map((entry) => (
                <TreeNode
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  isExpanded={isExpanded}
                  getChildren={getChildren}
                  onToggleExpand={toggleExpand}
                  onFileSelect={onFileSelect}
                  isSupportedFile={isSupportedFile}
                  activeDocumentId={activeDocumentId}
                />
              ))}
            </nav>
          </>
        )}
      </div>
    </aside>
  );
}
