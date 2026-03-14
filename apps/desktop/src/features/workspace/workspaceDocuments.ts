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
