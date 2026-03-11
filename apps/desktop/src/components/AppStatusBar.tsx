/**
 * Application-level status bar — main status layer of the desktop shell.
 * Displays app state: project, active document, dirty, approximate word count, chat visibility.
 *
 * Provisional decisions (this cycle):
 * - Absorption of DocumentStatusBar: practical decision, not final conceptual resolution.
 * - Word count (~N words): explicitly approximate and provisional; coherent with HTML string
 *   contract and current application stage.
 */
interface AppStatusBarProps {
  projectFolderName: string;
  /** Full project path for tooltip when available */
  projectRootPath?: string | null;
  hasActiveTab: boolean;
  activeDocumentLabel: string;
  /** Approximate word count from current HTML content. Explicitly provisional. */
  wordCount: number;
  chatVisible: boolean;
  isDirty: boolean;
}

export function AppStatusBar({
  projectFolderName,
  projectRootPath,
  hasActiveTab,
  activeDocumentLabel,
  wordCount,
  chatVisible,
  isDirty,
}: AppStatusBarProps) {
  const projectLabel = projectFolderName || "No project";
  const documentLabel = hasActiveTab ? activeDocumentLabel : "No document";

  return (
    <div
      className="flex shrink-0 items-center gap-4 border-t border-zinc-800 bg-zinc-950 px-4 py-1.5 text-[10px] font-semibold text-zinc-500"
      role="status"
      style={{ minHeight: 24 }}
    >
      <span
        className="truncate"
        title={projectRootPath || projectFolderName || undefined}
      >
        {projectLabel}
      </span>
      <span className="h-2.5 w-px bg-zinc-700" aria-hidden />
      <span className="truncate">{documentLabel}</span>

      {hasActiveTab && isDirty && (
        <>
          <span className="h-2.5 w-px bg-zinc-700" aria-hidden />
          <span className="text-zinc-400">Edited</span>
        </>
      )}

      {hasActiveTab && (
        <>
          <span className="h-2.5 w-px bg-zinc-700" aria-hidden />
          <span
            title="Approximate count from current HTML content (provisional)"
            aria-label="Approximate word count"
          >
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
