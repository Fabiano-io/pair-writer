import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectExplorer } from "./useProjectExplorer";
import { createProjectFile } from "../project/projectAccess";
import type { DirEntry } from "../project/projectAccess";
import { useTranslation } from "../settings/i18n/useTranslation";

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

const INVALID_FILENAME_CHARS = new Set(["<", ">", ":", '"', "/", "\\", "|", "?", "*"]);

function hasInvalidFilenameChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code >= 0 && code <= 31) return true;
    if (INVALID_FILENAME_CHARS.has(ch)) return true;
  }
  return false;
}

function TreeNode({
  entry,
  depth,
  isExpanded,
  getChildren,
  onToggleExpand,
  onFileSelect,
  isSupportedFile,
  activeDocumentId,
  unsupportedTitle,
}: {
  entry: DirEntry;
  depth: number;
  isExpanded: (path: string) => boolean;
  getChildren: (path: string) => DirEntry[];
  onToggleExpand: (path: string) => void;
  onFileSelect: (path: string) => void;
  isSupportedFile: (path: string) => boolean;
  activeDocumentId: string | null;
  unsupportedTitle: string;
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
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
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
                unsupportedTitle={unsupportedTitle}
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
            ? "bg-[var(--app-surface-alt)]/70 text-[var(--app-text)]"
            : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
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
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--app-text-muted)]/70"
      style={{ paddingLeft: 8 + depth * 12 }}
      title={unsupportedTitle}
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
  const { t } = useTranslation();
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
      setCreateError(t("explorer_error_empty"));
      return;
    }

    if (hasInvalidFilenameChars(trimmed)) {
      setCreateError(t("explorer_error_invalid"));
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
        setCreateError(t("explorer_error_exists"));
      } else {
        setCreateError(t("explorer_error_create"));
      }
    } finally {
      submittingRef.current = false;
    }
  }, [newFileName, projectRootPath, refreshRoot, onCreateDocument, t]);

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-bg)]"
      style={{ width }}
    >
      <div
        className="flex items-center gap-2 border-b border-[var(--app-border)] px-4"
        style={{ minHeight: 32 }}
      >
        <span className="text-base" aria-hidden>✦</span>
        <span className="text-sm font-semibold tracking-wide text-[var(--app-text)]">
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
            <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)] px-3 py-2">
              <span
                className="truncate text-sm font-medium text-[var(--app-text)]/90"
                title={projectRootPath}
              >
                {getFolderName(projectRootPath)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={startCreating}
                  className="rounded px-1.5 py-0.5 text-sm text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  title={t("explorer_new_doc")}
                  aria-label={t("explorer_new_doc")}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={selectProjectFolder}
                  className="rounded px-1.5 py-0.5 text-xs text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  title={t("explorer_change_folder")}
                  aria-label={t("explorer_change_folder")}
                >
                  {t("explorer_change")}
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
                    placeholder={t("explorer_doc_name_placeholder")}
                    className="w-full rounded border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/60 outline-none focus:border-[var(--app-surface-alt)]"
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
                  unsupportedTitle={t("explorer_unsupported")}
                />
              ))}
            </nav>
          </>
        )}
      </div>
    </aside>
  );
}
