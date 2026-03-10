import { useState } from "react";
import { DocumentEditorSurface } from "./components/DocumentEditorSurface";

interface DocumentPaneProps {
  title: string;
}

const PROVISIONAL_CONTENT = `Pair Writer is a desktop writing environment designed for structured thinking and AI-assisted content creation. It combines a focused document editor with contextual AI chat that lives alongside each document.

The core experience prioritizes rendered content over raw markup, delivering an editorial feel that keeps writers immersed in their ideas rather than formatting syntax.

[This is a transitional plain text area. The real TipTap rich-text engine will replace this space.]`;

export function DocumentPane({ title: initialTitle }: DocumentPaneProps) {
  // Provisional state to sustain the controlled contract of the canonical surface
  const [title, setTitle] = useState(initialTitle);
  // Provisional state for document body, allowing data to flow through the contract
  const [content, setContent] = useState(PROVISIONAL_CONTENT);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950/20">
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden outline-none">
        <div className="mx-auto flex w-full max-w-[800px] flex-1 min-h-0 flex-col px-12 py-16 lg:px-20 lg:py-24">
          <DocumentEditorSurface 
            title={title} 
            content={content}
            onTitleChange={setTitle} 
            onContentChange={setContent}
          />
        </div>
      </div>
    </main>
  );
}
