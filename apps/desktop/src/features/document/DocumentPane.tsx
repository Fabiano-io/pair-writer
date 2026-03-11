import { useEffect, useState } from "react";
import { DocumentEditorSurface } from "./components/DocumentEditorSurface";

const PROVISIONAL_CONTENT = `Pair Writer is a desktop writing environment designed for structured thinking and AI-assisted content creation. It combines a focused document editor with contextual AI chat that lives alongside each document.

The core experience prioritizes rendered content over raw markup, delivering an editorial feel that keeps writers immersed in their ideas rather than formatting syntax.

[This is a transitional plain text area. The real TipTap rich-text engine will replace this space.]`;

interface DocumentPaneProps {
  title: string;
  /** When provided with onContentChange, enables controlled mode (e.g. per-tab content in workspace). */
  content?: string;
  onContentChange?: (html: string) => void;
  onSave?: () => void;
  isSaveable?: boolean;
}

export function DocumentPane({
  title: initialTitle,
  content: controlledContent,
  onContentChange: onControlledContentChange,
  onSave,
  isSaveable = false,
}: DocumentPaneProps) {
  const [title, setTitle] = useState(initialTitle);
  const [localContent, setLocalContent] = useState(PROVISIONAL_CONTENT);

  const isControlled = controlledContent !== undefined && onControlledContentChange !== undefined;
  const content = isControlled ? controlledContent : localContent;
  const setContent = isControlled ? onControlledContentChange : setLocalContent;

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950/20">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden outline-none">
        <div className="mx-auto flex w-full max-w-[800px] flex-1 min-h-0 flex-col px-12 pt-6 pb-16 lg:px-20 lg:pt-8 lg:pb-24">
          <DocumentEditorSurface
            title={title}
            content={content}
            onTitleChange={setTitle}
            onContentChange={setContent}
            onSave={onSave}
            isSaveable={isSaveable}
          />
        </div>
      </div>
    </main>
  );
}
