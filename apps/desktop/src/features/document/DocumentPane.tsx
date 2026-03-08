import { DocumentEditorSurface } from "./components/DocumentEditorSurface";

interface DocumentPaneProps {
  title: string;
}

export function DocumentPane({ title }: DocumentPaneProps) {
  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950/20">
      <DocumentEditorSurface initialTitle={title} />
    </main>
  );
}
