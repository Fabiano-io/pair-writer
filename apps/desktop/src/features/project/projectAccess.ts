/**
 * Project file access layer.
 * Uses Tauri commands for directory listing and file read/write.
 * Filesystem is the operational source for this cycle only — practical decision, not final architecture.
 */

import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

/** Supported file extensions for opening in editor. */
export const MARKDOWN_FILE_EXTENSIONS = [".md"] as const;
export const PLAIN_TEXT_FILE_EXTENSIONS = [
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
  ".log",
  ".ini",
  ".toml",
  ".xml",
  ".env",
  ".properties",
] as const;
export const JSON_YAML_FILE_EXTENSIONS = [".json", ".yaml", ".yml"] as const;
export const RICH_HTML_FILE_EXTENSIONS = [".html"] as const;
export const PDF_FILE_EXTENSIONS = [".pdf"] as const;
export const DOCX_FILE_EXTENSIONS = [".docx"] as const;

export const SUPPORTED_FILE_EXTENSIONS = [
  ...MARKDOWN_FILE_EXTENSIONS,
  ...PLAIN_TEXT_FILE_EXTENSIONS,
  ...RICH_HTML_FILE_EXTENSIONS,
  ...PDF_FILE_EXTENSIONS,
  ...DOCX_FILE_EXTENSIONS,
] as const;

function hasAnyFileExtension(path: string, extensions: readonly string[]): boolean {
  const lower = path.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export function isMarkdownFile(path: string): boolean {
  return hasAnyFileExtension(path, MARKDOWN_FILE_EXTENSIONS);
}

export function isPlainTextFile(path: string): boolean {
  return hasAnyFileExtension(path, PLAIN_TEXT_FILE_EXTENSIONS);
}

export function isJsonYamlFile(path: string): boolean {
  return hasAnyFileExtension(path, JSON_YAML_FILE_EXTENSIONS);
}

export function isPdfFile(path: string): boolean {
  return hasAnyFileExtension(path, PDF_FILE_EXTENSIONS);
}

export function isDocxFile(path: string): boolean {
  return hasAnyFileExtension(path, DOCX_FILE_EXTENSIONS);
}

export function isSupportedFile(path: string): boolean {
  return hasAnyFileExtension(path, SUPPORTED_FILE_EXTENSIONS);
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
 * Reads file content as raw binary.
 * Optionally validates that file is within project root.
 */
export async function readFileBinary(
  filePath: string,
  projectRoot?: string | null
): Promise<Uint8Array> {
  try {
    const bytes = await invoke<number[]>("read_file_binary", {
      filePath,
      projectRoot: projectRoot ?? null,
    });
    return new Uint8Array(bytes);
  } catch (error) {
    console.error("Failed to read file binary:", error);
    throw error;
  }
}

/**
 * Converts DOCX file to PDF using backend engines (Office/LibreOffice) and returns PDF bytes.
 * Optionally validates that file is within project root.
 */
export async function renderDocxAsPdf(
  filePath: string,
  projectRoot?: string | null
): Promise<Uint8Array> {
  try {
    const bytes = await invoke<number[]>("render_docx_as_pdf", {
      filePath,
      projectRoot: projectRoot ?? null,
    });
    return new Uint8Array(bytes);
  } catch (error) {
    console.error("Failed to render DOCX as PDF:", error);
    throw error;
  }
}

/**
 * Exports text-based document content as a PDF file.
 * The backend writes the PDF to outputFilePath and returns the final path.
 */
export async function exportTextDocumentAsPdf(
  sourceFilePath: string,
  outputFilePath: string,
  content: string,
  projectRoot?: string | null
): Promise<string> {
  try {
    return await invoke<string>("export_text_document_as_pdf", {
      sourceFilePath,
      outputFilePath,
      content,
      projectRoot: projectRoot ?? null,
    });
  } catch (error) {
    console.error("Failed to export document as PDF:", error);
    throw error;
  }
}

/**
 * Exports rendered HTML document content as a PDF file using browser print engine.
 * The backend writes the PDF to outputFilePath and returns the final path.
 */
export async function exportHtmlDocumentAsPdf(
  sourceFilePath: string,
  outputFilePath: string,
  htmlContent: string,
  projectRoot?: string | null
): Promise<string> {
  try {
    return await invoke<string>("export_html_document_as_pdf", {
      sourceFilePath,
      outputFilePath,
      htmlContent,
      projectRoot: projectRoot ?? null,
    });
  } catch (error) {
    console.error("Failed to export rendered HTML as PDF:", error);
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
 * Writes binary content to file.
 * Optionally validates that file is within project root.
 */
export async function saveFileBinary(
  filePath: string,
  bytes: Uint8Array,
  projectRoot?: string | null
): Promise<void> {
  try {
    await invoke("save_file_binary", {
      filePath,
      bytes: Array.from(bytes),
      projectRoot: projectRoot ?? null,
    });
  } catch (error) {
    console.error("Failed to save binary file:", error);
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
/**
 * Creates a new folder inside the target directory using an auto-generated unique name.
 * Returns the created folder path.
 */
export async function createProjectFolder(
  targetDir: string,
  projectRoot: string,
  baseName: string
): Promise<string> {
  return await invoke<string>("create_project_folder", {
    targetDir,
    projectRoot,
    baseName,
  });
}
/**
 * Renames a file or folder inside the project root.
 * Returns the new absolute path.
 */
export async function renameProjectEntry(
  entryPath: string,
  newName: string,
  projectRoot: string
): Promise<string> {
  return await invoke<string>("rename_project_entry", {
    entryPath,
    newName,
    projectRoot,
  });
}

/**
 * Moves a file or folder to another directory inside the project root.
 * Returns the new absolute path.
 */
export async function moveProjectEntry(
  entryPath: string,
  targetDir: string,
  projectRoot: string
): Promise<string> {
  return await invoke<string>("move_project_entry", {
    entryPath,
    targetDir,
    projectRoot,
  });
}
/**
 * Deletes a file or folder inside the project root.
 */
export async function deleteProjectEntry(
  entryPath: string,
  projectRoot: string
): Promise<void> {
  await invoke("delete_project_entry", {
    entryPath,
    projectRoot,
  });
}

/**
 * Pastes a copied file into a target directory using an auto-generated name.
 * Returns the created file path.
 */
export async function pasteCopiedProjectFile(
  entryPath: string,
  targetDir: string,
  projectRoot: string,
  baseName: string
): Promise<string> {
  return await invoke<string>("paste_copied_project_file", {
    entryPath,
    targetDir,
    projectRoot,
    baseName,
  });
}


