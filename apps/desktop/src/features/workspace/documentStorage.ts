import { invoke } from "@tauri-apps/api/core";

/**
 * Load document content from local storage. Returns null if no content exists.
 */
export async function loadDocumentContent(
  documentId: string
): Promise<string | null> {
  try {
    return await invoke<string | null>("load_document_content", {
      document_id: documentId,
    });
  } catch (error) {
    console.error("Failed to load document content:", error);
    return null;
  }
}

/**
 * Save document content to local storage. Logs on error.
 */
export async function saveDocumentContent(
  documentId: string,
  content: string
): Promise<void> {
  try {
    await invoke("save_document_content", {
      document_id: documentId,
      content,
    });
  } catch (error) {
    console.error("Failed to save document content:", error);
  }
}
