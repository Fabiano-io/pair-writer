/**
 * Project file access layer.
 * Uses Tauri commands for directory listing and file read/write.
 * Filesystem is the operational source for this cycle only — practical decision, not final architecture.
 */

import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

/** Supported file extensions for opening in editor (.md, .txt, .html). */
export const SUPPORTED_FILE_EXTENSIONS = [".md", ".txt", ".html"] as const;

export function isSupportedFile(path: string): boolean {
  const lower = path.toLowerCase();
  return SUPPORTED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

/**
 * Opens native folder picker. Returns selected path or null if cancelled.
 */
export async function pickProjectFolder(): Promise<string | null> {
  try {
    const result = await open({
      directory: true,
      multiple: false,
      title: "Select project folder",
    });
    return typeof result === "string" ? result : null;
  } catch (error) {
    console.error("Failed to pick project folder:", error);
    return null;
  }
}

/**
 * Reads directory entries (files and subdirectories).
 * Skips hidden entries (names starting with .).
 */
export async function readDirectoryEntries(
  basePath: string
): Promise<DirEntry[]> {
  try {
    return await invoke<DirEntry[]>("read_directory_entries", {
      basePath,
    });
  } catch (error) {
    console.error("Failed to read directory entries:", error);
    throw error;
  }
}

/**
 * Reads file content as UTF-8 text.
 * Optionally validates that file is within project root.
 */
export async function readFileContent(
  filePath: string,
  projectRoot?: string | null
): Promise<string> {
  try {
    return await invoke<string>("read_file_content", {
      filePath,
      projectRoot: projectRoot ?? null,
    });
  } catch (error) {
    console.error("Failed to read file content:", error);
    throw error;
  }
}

/**
 * Writes content to file.
 * Optionally validates that file is within project root.
 */
export async function saveFileContent(
  filePath: string,
  content: string,
  projectRoot?: string | null
): Promise<void> {
  try {
    await invoke("save_file_content", {
      filePath,
      content,
      projectRoot: projectRoot ?? null,
    });
  } catch (error) {
    console.error("Failed to save file content:", error);
    throw error;
  }
}

/**
 * Creates a new empty file inside the project. Fails if file already exists.
 * Returns the created file path.
 */
export async function createProjectFile(
  filePath: string,
  projectRoot: string
): Promise<string> {
  return await invoke<string>("create_project_file", {
    filePath,
    projectRoot,
  });
}
