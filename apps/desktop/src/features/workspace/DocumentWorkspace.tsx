import { WorkspaceTabs } from "./WorkspaceTabs";
import { DocumentPane } from "../document/DocumentPane";
import { DocumentChatPane } from "../chat/DocumentChatPane";

const ACTIVE_DOCUMENT_TITLE = "Product Vision";

export function DocumentWorkspace() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-900">
      <WorkspaceTabs />

      <div className="flex flex-1 overflow-hidden">
        <DocumentPane title={ACTIVE_DOCUMENT_TITLE} />
        <DocumentChatPane documentTitle={ACTIVE_DOCUMENT_TITLE} />
      </div>
    </div>
  );
}
