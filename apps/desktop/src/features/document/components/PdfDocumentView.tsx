import { useEffect, useRef, useState } from "react";
import { readFileBinary } from "../../project/projectAccess";
import { loadSettings } from "../../settings/appSettings";

interface PdfDocumentViewProps {
  filePath: string;
}

export function PdfDocumentView({ filePath }: PdfDocumentViewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearObjectUrl = () => {
      if (!objectUrlRef.current) return;
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };

    clearObjectUrl();
    setPdfUrl(null);
    setLoadError(null);
    setIsLoading(true);

    (async () => {
      try {
        const settings = await loadSettings();
        const bytes = await readFileBinary(filePath, settings.projectRootPath ?? undefined);
        if (cancelled) return;

        const normalizedBytes = new Uint8Array(bytes.byteLength);
        normalizedBytes.set(bytes);
        const blob = new Blob([normalizedBytes.buffer], { type: "application/pdf" });
        const nextObjectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = nextObjectUrl;
        setPdfUrl(nextObjectUrl);
      } catch {
        if (cancelled) return;
        setLoadError("Unable to load PDF preview.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearObjectUrl();
    };
  }, [filePath]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--app-bg)]/6">
      {isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--app-text-muted)]">
          Loading PDF preview...
        </div>
      ) : loadError || !pdfUrl ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-red-400/90">
          {loadError ?? "Unable to load PDF preview."}
        </div>
      ) : (
        <iframe
          key={pdfUrl}
          src={`${pdfUrl}#view=FitH&zoom=page-width`}
          title="PDF preview"
          className="h-full min-h-0 w-full border-0 bg-[var(--app-surface)]"
        />
      )}
    </div>
  );
}
