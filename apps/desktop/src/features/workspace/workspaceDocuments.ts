export interface WorkspaceDocument {
  id: string;
  label: string;
  group: string;
}

/**
 * Provisional catalog of documents available in the workspace.
 * Shared between ExplorerSidebar and DocumentWorkspace so both
 * use the same ids, labels, and grouping.
 *
 * This is mock/local data — not a final domain model.
 */
export const WORKSPACE_DOCUMENTS: WorkspaceDocument[] = [
  { id: "product-vision", label: "Product Vision", group: "Project" },
  { id: "context-engine", label: "Context Engine", group: "Project" },
  { id: "checkpoints", label: "Checkpoints", group: "Project" },
  { id: "patterns", label: "Patterns", group: "Global" },
  { id: "references", label: "References", group: "Global" },
];

export const INITIAL_OPEN_TAB_IDS = [
  "product-vision",
  "context-engine",
  "checkpoints",
];

export const PROVISIONAL_CONTENT = `Pair Writer is a desktop writing environment designed for structured thinking and AI-assisted content creation. It combines a focused document editor with contextual AI chat that lives alongside each document.

The core experience prioritizes rendered content over raw markup, delivering an editorial feel that keeps writers immersed in their ideas rather than formatting syntax.

[This is a transitional plain text area. The real TipTap rich-text engine will replace this space.]`;
