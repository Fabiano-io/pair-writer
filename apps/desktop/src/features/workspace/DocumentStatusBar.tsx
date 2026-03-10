/**
 * Document status bar — footer of the document area.
 * Displays local, provisional info only. No persistence, sync, or AI status.
 */
interface DocumentStatusBarProps {
  hasActiveTab: boolean;
  activeDocumentLabel: string;
  /** Approximate word count derived from current HTML content (local, provisional). */
  wordCount: number;
  chatVisible: boolean;
}

export function DocumentStatusBar({
  hasActiveTab,
  activeDocumentLabel,
  wordCount,
  chatVisible,
}: DocumentStatusBarProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-4 border-t border-zinc-800 bg-zinc-950 px-4 py-1 text-[10px] font-semibold text-zinc-500"
      role="status"
    >
      <span className="truncate">
        {hasActiveTab ? activeDocumentLabel : "No document open"}
      </span>

      {hasActiveTab && (
        <>
          <span className="h-2.5 w-px bg-zinc-700" aria-hidden />
          <span title="Approximate count from current HTML content">
            ~{wordCount} words
          </span>
        </>
      )}

      <span className="ml-auto flex items-center gap-1.5" aria-hidden>
        <span
          className={`h-1.5 w-1.5 rounded-full bg-current ${chatVisible ? "opacity-100" : "opacity-40"}`}
        />
        <span>Chat {chatVisible ? "on" : "off"}</span>
      </span>
    </div>
  );
}
