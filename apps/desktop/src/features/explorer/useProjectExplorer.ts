import { useCallback, useEffect, useState } from "react";
import {
  pickProjectFolder,
  readDirectoryEntries,
  isSupportedFile,
  type DirEntry,
} from "../project/projectAccess";
import { loadSettings, saveProjectRootPath } from "../settings/appSettings";

export interface ProjectExplorerState {
  projectRootPath: string | null;
  rootEntries: DirEntry[];
  childrenByPath: Record<string, DirEntry[]>;
  expandedPaths: Set<string>;
  isLoading: boolean;
  selectProjectFolder: () => Promise<void>;
  toggleExpand: (path: string) => void;
  isExpanded: (path: string) => boolean;
  getChildren: (path: string) => DirEntry[];
  isSupportedFile: (path: string) => boolean;
}

export function useProjectExplorer(): ProjectExplorerState {
  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([]);
  const [childrenByPath, setChildrenByPath] = useState<Record<string, DirEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadRoot = useCallback(async (path: string) => {
    try {
      const entries = await readDirectoryEntries(path);
      setRootEntries(entries);
      setChildrenByPath((prev) => ({ ...prev, [path]: entries }));
    } catch (error) {
      console.error("Failed to load project root:", error);
      setRootEntries([]);
    }
  }, []);

  const loadFolder = useCallback(async (path: string) => {
    try {
      const entries = await readDirectoryEntries(path);
      setChildrenByPath((prev) => ({ ...prev, [path]: entries }));
    } catch (error) {
      console.error("Failed to load folder:", error);
    }
  }, []);

  useEffect(() => {
    loadSettings().then((settings) => {
      const path = settings.projectRootPath ?? null;
      setProjectRootPath(path);
      if (path) {
        loadRoot(path);
      } else {
        setRootEntries([]);
      }
      setIsLoading(false);
    });
  }, [loadRoot]);

  const selectProjectFolder = useCallback(async () => {
    const path = await pickProjectFolder();
    if (!path) return;

    setProjectRootPath(path);
    setExpandedPaths(new Set());
    setChildrenByPath({});
    await saveProjectRootPath(path);
    await loadRoot(path);
  }, [loadRoot]);

  const toggleExpand = useCallback(
    (path: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          if (!childrenByPath[path]) {
            loadFolder(path);
          }
        }
        return next;
      });
    },
    [childrenByPath, loadFolder]
  );

  const isExpanded = useCallback(
    (path: string) => expandedPaths.has(path),
    [expandedPaths]
  );

  const getChildren = useCallback(
    (path: string) => childrenByPath[path] ?? [],
    [childrenByPath]
  );

  return {
    projectRootPath,
    rootEntries,
    childrenByPath,
    expandedPaths,
    isLoading,
    selectProjectFolder,
    toggleExpand,
    isExpanded,
    getChildren,
    isSupportedFile,
  };
}
