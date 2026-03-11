import { WorkspaceTabs } from "./WorkspaceTabs";
import { DocumentPane } from "../document/DocumentPane";
import { DocumentChatPane } from "../chat/DocumentChatPane";
import { DocumentStatusBar } from "./DocumentStatusBar";
import { ResizeHandle } from "../../components/ResizeHandle";
import { PROVISIONAL_CONTENT } from "./workspaceDocuments";
import type { WorkspaceDocument } from "./workspaceDocuments";

function approximateWordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").filter(Boolean).length : 0;
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
}: DocumentWorkspaceProps) {
  const isDirty = activeTabId ? dirtyTabIds.has(activeTabId) : false;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-900">
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
              content={contentByTabId[activeTabId!] ?? PROVISIONAL_CONTENT}
              onContentChange={onContentChange}
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
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
            No document open
          </div>
        )}
      </div>

      <DocumentStatusBar
        hasActiveTab={hasActiveTab}
        activeDocumentLabel={activeDocument?.label ?? ""}
        wordCount={
          hasActiveTab
            ? approximateWordCount(
                contentByTabId[activeTabId!] ?? PROVISIONAL_CONTENT
              )
            : 0
        }
        chatVisible={chatVisible}
        isDirty={isDirty}
      />
    </div>
  );
}
