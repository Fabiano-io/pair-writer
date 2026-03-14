import { useEffect, useState } from "react";
import { renderDocxAsPdf } from "../../project/projectAccess";
import { loadSettings } from "../../settings/appSettings";

interface DocxDocumentViewProps {
  filePath: string;
}

const DOCX_PREVIEW_CACHE_LIMIT = 8;
const docxPreviewCache = new Map<string, string>();
let docxPreviewCleanupRegistered = false;

function ensureDocxPreviewCleanupRegistration() {
  if (docxPreviewCleanupRegistered || typeof window === "undefined") return;
  window.addEventListener("beforeunload", () => {
    for (const url of docxPreviewCache.values()) {
      URL.revokeObjectURL(url);
    }
    docxPreviewCache.clear();
  });
  docxPreviewCleanupRegistered = true;
}

function getCachedDocxPreview(filePath: string): string | null {
  const cached = docxPreviewCache.get(filePath);
  if (!cached) return null;

  // Refresh LRU order.
  docxPreviewCache.delete(filePath);
  docxPreviewCache.set(filePath, cached);
  return cached;
}

function setCachedDocxPreview(filePath: string, previewUrl: string): void {
  const existing = docxPreviewCache.get(filePath);
  if (existing && existing !== previewUrl) {
    URL.revokeObjectURL(existing);
  }

  if (existing) {
    docxPreviewCache.delete(filePath);
  }

  docxPreviewCache.set(filePath, previewUrl);

  while (docxPreviewCache.size > DOCX_PREVIEW_CACHE_LIMIT) {
    const oldest = docxPreviewCache.entries().next().value as
      | [string, string]
      | undefined;
    if (!oldest) break;
    const [oldPath, oldUrl] = oldest;
    docxPreviewCache.delete(oldPath);
    URL.revokeObjectURL(oldUrl);
  }
}

export function DocxDocumentView({ filePath }: DocxDocumentViewProps) {
  const initialCachedPreview = getCachedDocxPreview(filePath);
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialCachedPreview);
  const [isLoading, setIsLoading] = useState(!initialCachedPreview);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    ensureDocxPreviewCleanupRegistration();

    let cancelled = false;
    const cached = getCachedDocxPreview(filePath);
    if (cached) {
      setPdfUrl(cached);
      setLoadError(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setPdfUrl(null);
    setLoadError(null);
    setIsLoading(true);

    (async () => {
      try {
        const settings = await loadSettings();
        const bytes = await renderDocxAsPdf(
          filePath,
          settings.projectRootPath ?? undefined
        );
        if (cancelled) return;

        const normalizedBytes = new Uint8Array(bytes.byteLength);
        normalizedBytes.set(bytes);
        const blob = new Blob([normalizedBytes.buffer], { type: "application/pdf" });
        const nextObjectUrl = URL.createObjectURL(blob);
        setCachedDocxPreview(filePath, nextObjectUrl);
        setPdfUrl(nextObjectUrl);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load DOCX preview:", error);
        const reason =
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : "";
        setLoadError(
          `Unable to render DOCX with Office/PDF engines. Ensure Microsoft Word or LibreOffice is installed.${reason ? ` Details: ${reason}` : ""}`
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--app-bg)]/6">
      {isLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--app-text-muted)]">
          Loading DOCX preview...
        </div>
      ) : loadError || !pdfUrl ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-red-400/90">
          {loadError ?? "Unable to load DOCX preview."}
        </div>
      ) : (
        <iframe
          key={pdfUrl}
          src={`${pdfUrl}#view=FitH&zoom=page-width`}
          title="DOCX preview"
          className="h-full min-h-0 w-full border-0 bg-[var(--app-surface)]"
        />
      )}
    </div>
  );
}
