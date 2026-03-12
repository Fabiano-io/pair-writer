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
  refreshTree: () => Promise<void>;
  toggleExpand: (path: string) => Promise<void>;
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

  const loadFolder = useCallback(async (path: string): Promise<DirEntry[]> => {
    try {
      const entries = await readDirectoryEntries(path);
      setChildrenByPath((prev) => ({ ...prev, [path]: entries }));
      return entries;
    } catch (error) {
      console.error("Failed to load folder:", error);
      setChildrenByPath((prev) => ({ ...prev, [path]: [] }));
      return [];
    }
  }, []);

  const loadRoot = useCallback(async (path: string) => {
    try {
      const entries = await readDirectoryEntries(path);
      setRootEntries(entries);
      setChildrenByPath((prev) => ({ ...prev, [path]: entries }));
    } catch (error) {
      console.error("Failed to load project root:", error);
      setRootEntries([]);
      setChildrenByPath((prev) => ({ ...prev, [path]: [] }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setIsLoading(true);
      const settings = await loadSettings();
      if (!mounted) return;

      const path = settings.projectRootPath ?? null;
      setProjectRootPath(path);
      setChildrenByPath({});
      setExpandedPaths(new Set());

      if (path) {
        await loadRoot(path);
      } else {
        setRootEntries([]);
      }

      if (mounted) {
        setIsLoading(false);
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, [loadRoot]);

  const refreshTree = useCallback(async () => {
    if (!projectRootPath) return;

    await loadRoot(projectRootPath);

    const pathsToReload = Array.from(expandedPaths).sort(
      (a, b) => a.length - b.length
    );

    for (const path of pathsToReload) {
      await loadFolder(path);
    }
  }, [projectRootPath, expandedPaths, loadRoot, loadFolder]);

  const selectProjectFolder = useCallback(async () => {
    const path = await pickProjectFolder();
    if (!path) return;

    setIsLoading(true);
    setProjectRootPath(path);
    setChildrenByPath({});
    setExpandedPaths(new Set());
    await saveProjectRootPath(path);
    await loadRoot(path);
    setIsLoading(false);
  }, [loadRoot]);

  const toggleExpand = useCallback(async (path: string) => {
    const currentlyExpanded = expandedPaths.has(path);
    const hasLoadedChildren = path in childrenByPath;

    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    if (!currentlyExpanded && !hasLoadedChildren) {
      await loadFolder(path);
    }
  }, [expandedPaths, childrenByPath, loadFolder]);

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
    refreshTree,
    toggleExpand,
    isExpanded,
    getChildren,
    isSupportedFile,
  };
}
