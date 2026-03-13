import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppMenuBar } from "../components/AppMenuBar";
import { AppStatusBar } from "../components/AppStatusBar";
import { UnsavedChangesDialog } from "../components/UnsavedChangesDialog";
import { ExplorerSidebar } from "../features/explorer/ExplorerSidebar";
import { DocumentWorkspace } from "../features/workspace/DocumentWorkspace";
import { ResizeHandle } from "../components/ResizeHandle";
import { useWorkspaceLayout } from "../features/workspace/useWorkspaceLayout";
import { useWorkspaceDocuments } from "../features/workspace/useWorkspaceDocuments";
import { loadSettings, saveProjectRootPath } from "../features/settings/appSettings";
import { PROVISIONAL_CONTENT } from "../features/workspace/workspaceDocuments";
import type { AppearanceSettings } from "../features/settings/settingsDefaults";
import { DEFAULT_APPEARANCE } from "../features/settings/settingsDefaults";
import { I18nProvider } from "../features/settings/i18n/I18nContext";
import { PreferencesModal } from "../features/settings/PreferencesModal";
import {
  dispatchEditorCopy,
  dispatchEditorCut,
  dispatchEditorPaste,
  dispatchEditorRedo,
  dispatchEditorUndo,
} from "../features/document/editorCommandEvents";
import { pickProjectFolder } from "../features/project/projectAccess";

/** Approximate word count from HTML. Explicitly provisional; coherent with HTML string contract. */
function approximateWordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").filter(Boolean).length : 0;
}

function getFolderName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function isMarkdownDocument(tabId: string | null): boolean {
  return tabId?.toLowerCase().endsWith(".md") ?? false;
}

export function AppShell() {
  const {
    explorerWidth,
    chatWidth,
    explorerVisible,
    chatVisible,
    toggleExplorer,
    toggleChat,
    onExplorerResize,
    onExplorerResizeEnd,
    onChatResize,
    onChatResizeEnd,
  } = useWorkspaceLayout();

  const workspace = useWorkspaceDocuments();

  const [projectRootPath, setProjectRootPath] = useState<string | null>(null);
  const [appearance, setAppearance] = useState<AppearanceSettings>(
    DEFAULT_APPEARANCE
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [markdownViewMode, setMarkdownViewMode] = useState<
    "rendered" | "source"
  >("rendered");

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setProjectRootPath(s.projectRootPath ?? null);
        setAppearance(s.appearance ?? DEFAULT_APPEARANCE);
      })
      .finally(() => {
        setIsBootstrapped(true);
      });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadSettings().then((s) => setProjectRootPath(s.projectRootPath ?? null));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAppearanceSaved = useCallback((next: AppearanceSettings) => {
    setAppearance(next);
  }, []);

  const saveActiveDocument = workspace.saveActiveDocument;

  const isSaveable =
    workspace.hasActiveTab &&
    workspace.activeTabId !== null &&
    workspace.dirtyTabIds.has(workspace.activeTabId);

  const canToggleMarkdownView = isMarkdownDocument(workspace.activeTabId);
  const effectiveMarkdownViewMode = canToggleMarkdownView
    ? markdownViewMode
    : "rendered";

  const toggleMarkdownView = useCallback(() => {
    if (!canToggleMarkdownView) return;
    setMarkdownViewMode((current) =>
      current === "rendered" ? "source" : "rendered"
    );
  }, [canToggleMarkdownView]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isSaveable) {
          saveActiveDocument();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSaveable, saveActiveDocument]);

  const [newDocTrigger, setNewDocTrigger] = useState(0);

  const handleNewDocumentFromMenu = useCallback(() => {
    if (!explorerVisible) toggleExplorer();
    setNewDocTrigger((n) => n + 1);
  }, [explorerVisible, toggleExplorer]);

  const handleOpenProjectFromMenu = useCallback(async () => {
    const path = await pickProjectFolder();
    if (!path) return;

    await saveProjectRootPath(path);
    setProjectRootPath(path);

    if (!explorerVisible) {
      toggleExplorer();
    }
  }, [explorerVisible, toggleExplorer]);

  const handleExitAppFromMenu = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Failed to close app window:", error);
    }
  }, []);

  const pendingCloseDoc = workspace.pendingCloseTabId
    ? workspace.tabs.find((t) => t.id === workspace.pendingCloseTabId)
    : null;

  return (
    <I18nProvider locale={appearance.language}>
      <div
        className={`app-shell flex h-screen w-screen flex-col bg-[var(--app-bg)] text-[var(--app-text)] transition-opacity duration-300 ${isBootstrapped ? "opacity-100" : "opacity-0"}`}
        data-theme={appearance.theme}
        data-font-preset={appearance.fontPreset}
      >
        <AppMenuBar
          hasActiveTab={workspace.hasActiveTab}
          isSaveable={isSaveable}
          hasProject={projectRootPath !== null}
          onOpenProject={() => {
            void handleOpenProjectFromMenu();
          }}
          onExitApp={() => {
            void handleExitAppFromMenu();
          }}
          onCloseActiveTab={workspace.closeActiveTab}
          onCut={dispatchEditorCut}
          onCopy={dispatchEditorCopy}
          onPaste={dispatchEditorPaste}
          onUndo={dispatchEditorUndo}
          onRedo={dispatchEditorRedo}
          onSave={() => saveActiveDocument()}
          onNewDocument={handleNewDocumentFromMenu}
          onToggleExplorer={toggleExplorer}
          onToggleChat={toggleChat}
          onOpenPreferences={() => setPreferencesOpen(true)}
          explorerVisible={explorerVisible}
          chatVisible={chatVisible}
        />

        <div className="flex flex-1 overflow-hidden">
          {explorerVisible && (
            <>
              <ExplorerSidebar
                key={`explorer-${projectRootPath ?? "none"}`}
                width={explorerWidth}
                activeDocumentId={workspace.activeTabId}
                openDocumentIds={workspace.openTabIds}
                onFileSelect={workspace.openDocument}
                onCreateDocument={workspace.openDocument}
                onDeleteDocument={workspace.closeDocument}
                onRenameDocument={workspace.renameDocumentPath}
                newDocTrigger={newDocTrigger}
              />
              <ResizeHandle
                onResize={onExplorerResize}
                onResizeEnd={onExplorerResizeEnd}
              />
            </>
          )}
          <DocumentWorkspace
            chatWidth={chatWidth}
            chatVisible={chatVisible}
            onChatResize={onChatResize}
            onChatResizeEnd={onChatResizeEnd}
            tabs={workspace.tabs}
            activeTabId={workspace.activeTabId}
            activeDocument={workspace.activeDocument}
            contentByTabId={workspace.contentByTabId}
            hasActiveTab={workspace.hasActiveTab}
            dirtyTabIds={workspace.dirtyTabIds}
            onTabSelect={workspace.selectDocument}
            onTabClose={workspace.closeDocument}
            onContentChange={workspace.handleContentChange}
            onSave={saveActiveDocument}
            isSaveable={isSaveable}
            markdownViewMode={effectiveMarkdownViewMode}
            onToggleMarkdownView={toggleMarkdownView}
          />
        </div>

        <AppStatusBar
          projectFolderName={projectRootPath ? getFolderName(projectRootPath) : ""}
          projectRootPath={projectRootPath}
          hasActiveTab={workspace.hasActiveTab}
          activeDocumentLabel={workspace.activeDocument?.label ?? ""}
          wordCount={
            workspace.hasActiveTab && workspace.activeTabId
              ? approximateWordCount(
                  workspace.contentByTabId[workspace.activeTabId] ??
                    PROVISIONAL_CONTENT
                )
              : 0
          }
          chatVisible={chatVisible}
          isDirty={
            workspace.activeTabId
              ? workspace.dirtyTabIds.has(workspace.activeTabId)
              : false
          }
          canToggleMarkdownView={canToggleMarkdownView}
          markdownViewMode={effectiveMarkdownViewMode}
        />

        {pendingCloseDoc && (
          <UnsavedChangesDialog
            documentName={pendingCloseDoc.label}
            onSave={() => workspace.confirmClose("save")}
            onDiscard={() => workspace.confirmClose("discard")}
            onCancel={() => workspace.confirmClose("cancel")}
          />
        )}

        {preferencesOpen && (
          <PreferencesModal
            initialAppearance={appearance}
            onClose={() => setPreferencesOpen(false)}
            onSaved={handleAppearanceSaved}
          />
        )}
      </div>
    </I18nProvider>
  );
}
