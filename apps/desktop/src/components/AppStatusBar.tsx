/**
 * Application-level status bar — main status layer of the desktop shell.
 * Displays app state: project, active document, dirty, approximate word count, chat visibility.
 *
 * Provisional decisions (this cycle):
 * - Absorption of DocumentStatusBar: practical decision, not final conceptual resolution.
 * - Word count (~N words): explicitly approximate and provisional; coherent with HTML string
 *   contract and current application stage.
 */
import { useTranslation } from "../features/settings/i18n/useTranslation";

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
  canToggleMarkdownView?: boolean;
  markdownViewMode?: "rendered" | "source";
}

export function AppStatusBar({
  projectFolderName,
  projectRootPath,
  hasActiveTab,
  activeDocumentLabel,
  wordCount,
  chatVisible,
  isDirty,
  canToggleMarkdownView = false,
  markdownViewMode = "rendered",
}: AppStatusBarProps) {
  const { t } = useTranslation();
  const projectLabel = projectFolderName || t("status_no_project");
  const documentLabel = hasActiveTab
    ? activeDocumentLabel
    : t("status_no_document");

  const viewLabel =
    markdownViewMode === "rendered"
      ? t("status_view_rendered")
      : t("status_view_source");
  const viewTitle =
    markdownViewMode === "rendered"
      ? t("status_toggle_to_source")
      : t("status_toggle_to_rendered");

  return (
    <div
      className="flex shrink-0 items-center gap-4 border-t border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-1.5 text-[10px] font-semibold text-[var(--app-text-muted)]"
      role="status"
      style={{ minHeight: 24 }}
    >
      <span
        className="truncate"
        title={projectRootPath || projectFolderName || undefined}
      >
        {projectLabel}
      </span>
      <span className="h-2.5 w-px bg-[var(--app-border)]" aria-hidden />
      <span className="truncate">{documentLabel}</span>

      {hasActiveTab && isDirty && (
        <>
          <span className="h-2.5 w-px bg-[var(--app-border)]" aria-hidden />
          <span className="text-[var(--app-text-muted)]">{t("status_edited")}</span>
        </>
      )}

      {hasActiveTab && (
        <>
          <span className="h-2.5 w-px bg-[var(--app-border)]" aria-hidden />
          <span
            title="Approximate count from current HTML content (provisional)"
            aria-label="Approximate word count"
          >
            ~{wordCount} {t("status_words")}
          </span>
        </>
      )}

      {hasActiveTab && canToggleMarkdownView && (
        <>
          <span className="h-2.5 w-px bg-[var(--app-border)]" aria-hidden />
          <span title={viewTitle}>{viewLabel}</span>
        </>
      )}

      <span className="ml-auto flex items-center gap-1.5" aria-hidden>
        <span
          className={`h-1.5 w-1.5 rounded-full bg-current ${
            chatVisible ? "opacity-100" : "opacity-40"
          }`}
        />
        <span>{chatVisible ? t("status_chat_on") : t("status_chat_off")}</span>
      </span>
    </div>
  );
}