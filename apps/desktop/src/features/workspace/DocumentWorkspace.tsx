import { WorkspaceTabs } from "./WorkspaceTabs";
import { DocumentPane } from "../document/DocumentPane";
import { DocumentChatPane } from "../chat/DocumentChatPane";
import { ResizeHandle } from "../../components/ResizeHandle";
import type { WorkspaceDocument } from "./workspaceDocuments";
import { useTranslation } from "../settings/i18n/useTranslation";
import {
  isJsonYamlFile,
  isMarkdownFile,
  isPlainTextFile,
} from "../project/projectAccess";

function isMarkdownTab(tabId: string | null): boolean {
  return tabId ? isMarkdownFile(tabId) : false;
}

function isPlainTextTab(tabId: string | null): boolean {
  return tabId ? isPlainTextFile(tabId) : false;
}

function isJsonYamlTab(tabId: string | null): boolean {
  return tabId ? isJsonYamlFile(tabId) : false;
}

interface DocumentWorkspaceProps {
  chatWidth: number;
  chatVisible: boolean;
  onChatResize: (delta: number) => void;
  onChatResizeEnd: () => void;
  tabs: { id: string; label: string }[];
  activeTabId: string | null;
  activeDocument: WorkspaceDocument | undefined;
  contentByTabId: Record<string, string>;
  hasActiveTab: boolean;
  dirtyTabIds: Set<string>;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  isSaveable?: boolean;
  markdownViewMode?: "rendered" | "source";
  onToggleMarkdownView?: () => void;
}

export function DocumentWorkspace({
  chatWidth,
  chatVisible,
  onChatResize,
  onChatResizeEnd,
  tabs,
  activeTabId,
  activeDocument,
  contentByTabId,
  hasActiveTab,
  dirtyTabIds,
  onTabSelect,
  onTabClose,
  onContentChange,
  onSave,
  isSaveable = false,
  markdownViewMode = "rendered",
  onToggleMarkdownView,
}: DocumentWorkspaceProps) {
  const { t } = useTranslation();
  const activeIsMarkdown = isMarkdownTab(activeTabId);
  const activeIsPlainText = isPlainTextTab(activeTabId);
  const activeHasLineNumbers = isJsonYamlTab(activeTabId);
  const activeViewMode = activeIsMarkdown
    ? markdownViewMode
    : activeIsPlainText
      ? "source"
      : "rendered";

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--app-surface)]">
      <WorkspaceTabs
        tabs={tabs}
        activeTabId={activeTabId}
        dirtyTabIds={dirtyTabIds}
        onTabSelect={onTabSelect}
        onTabClose={onTabClose}
      />

      <div className="flex flex-1 overflow-hidden">
        {hasActiveTab ? (
          <>
            <DocumentPane
              title={activeDocument!.label}
              content={contentByTabId[activeTabId!] ?? ""}
              onContentChange={onContentChange}
              onSave={onSave}
              isSaveable={isSaveable}
              viewMode={activeViewMode}
              isMarkdownDocument={activeIsMarkdown}
              isPlainTextDocument={activeIsPlainText}
              showSourceLineNumbers={activeHasLineNumbers}
              onToggleMarkdownView={
                activeIsPlainText ? undefined : onToggleMarkdownView
              }
            />
            {chatVisible && (
              <>
                <ResizeHandle
                  onResize={onChatResize}
                  onResizeEnd={onChatResizeEnd}
                />
                <DocumentChatPane
                  documentTitle={activeDocument!.label}
                  width={chatWidth}
                />
              </>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--app-text-muted)]">
            {t("workspace_no_document")}
          </div>
        )}
      </div>
    </div>
  );
}
