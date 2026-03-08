import { WorkspaceTabs } from "./WorkspaceTabs";
import { DocumentPane } from "../document/DocumentPane";
import { DocumentChatPane } from "../chat/DocumentChatPane";
import { ResizeHandle } from "../../components/ResizeHandle";

const ACTIVE_DOCUMENT_TITLE = "Product Vision";

interface DocumentWorkspaceProps {
  chatWidth: number;
  onChatResize: (delta: number) => void;
  onChatResizeEnd: () => void;
}

export function DocumentWorkspace({
  chatWidth,
  onChatResize,
  onChatResizeEnd,
}: DocumentWorkspaceProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-900">
      <WorkspaceTabs />

      <div className="flex flex-1 overflow-hidden">
        <DocumentPane title={ACTIVE_DOCUMENT_TITLE} />
        <ResizeHandle onResize={onChatResize} onResizeEnd={onChatResizeEnd} />
        <DocumentChatPane
          documentTitle={ACTIVE_DOCUMENT_TITLE}
          width={chatWidth}
        />
      </div>
    </div>
  );
}
