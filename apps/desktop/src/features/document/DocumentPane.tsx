import { useState } from "react";
import { DocumentEditorSurface } from "./components/DocumentEditorSurface";

interface DocumentPaneProps {
  title: string;
}

export function DocumentPane({ title: initialTitle }: DocumentPaneProps) {
  // Provisional state to sustain the controlled contract of the canonical surface
  const [title, setTitle] = useState(initialTitle);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950/20">
      <div className="flex h-full w-full flex-col overflow-y-auto outline-none">
        <div className="mx-auto w-full max-w-[800px] px-12 py-16 lg:px-20 lg:py-24">
          <DocumentEditorSurface title={title} onTitleChange={setTitle} />
        </div>
      </div>
    </main>
  );
}
