import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ChatModelCatalogEntry } from "../settings/settingsDefaults";
import { useTranslation } from "../settings/i18n/useTranslation";
import { readFileBinary, readFileContent } from "../project/projectAccess";
import { ChatModelSelector } from "./ChatModelSelector";
import {
  AgentIcon,
  AskIcon,
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  FileIcon,
  ImageIcon,
  PlanIcon,
  PlusIcon,
  SendArrowIcon,
  ThinkIcon,
  ToolIcon,
} from "./ChatIcons";
import type { ChatAttachment, ChatDraftMessage, ChatMode } from "./chatTypes";

interface ChatInputProps {
  onSend: (draft: ChatDraftMessage) => void;
  isLoading: boolean;
  models: ChatModelCatalogEntry[];
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
  // Controlled per-document composer state
  composerText: string;
  onComposerTextChange: (text: string) => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  attachments: ChatAttachment[];
  onAttachmentsChange: (attachments: ChatAttachment[]) => void;
  composerError: string | null;
  onComposerErrorChange: (error: string | null) => void;
}

const MAX_TEXTAREA_HEIGHT = 320;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_ATTACHMENT_CHARS = 18000;

export function ChatInput({
  onSend,
  isLoading,
  models,
  selectedModelId,
  onSelectModel,
  composerText,
  onComposerTextChange,
  mode,
  onModeChange,
  attachments,
  onAttachmentsChange,
  composerError,
  onComposerErrorChange,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const selectedModel =
    models.find((model) => model.id === selectedModelId) ?? models[0] ?? null;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [composerText]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (
        attachMenuRef.current &&
        target &&
        !attachMenuRef.current.contains(target)
      ) {
        setAttachMenuOpen(false);
      }

      if (
        modeMenuRef.current &&
        target &&
        !modeMenuRef.current.contains(target)
      ) {
        setModeMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const canSend =
    !isLoading &&
    selectedModel !== null &&
    (composerText.trim().length > 0 || attachments.length > 0);

  async function handleAttachFile() {
    setAttachMenuOpen(false);
    onComposerErrorChange(null);

    const result = await open({
      directory: false,
      multiple: false,
      title: t("chat_attach_file"),
    });

    if (typeof result !== "string") {
      return;
    }

    const name = getFileName(result);

    try {
      const textContent = await readFileContent(result);
      const normalized =
        textContent.length > MAX_TEXT_ATTACHMENT_CHARS
          ? `${textContent.slice(0, MAX_TEXT_ATTACHMENT_CHARS)}\n\n[File truncated for chat context.]`
          : textContent;

      onAttachmentsChange(
        upsertAttachment(attachments, {
          id: buildAttachmentId(),
          kind: "file",
          name,
          path: result,
          textContent: normalized,
        })
      );
    } catch {
      onAttachmentsChange(
        upsertAttachment(attachments, {
          id: buildAttachmentId(),
          kind: "file",
          name,
          path: result,
          textContent: "Binary file attached. Raw contents were omitted from the prompt.",
        })
      );
    }
  }

  async function handleAttachImage() {
    setAttachMenuOpen(false);
    onComposerErrorChange(null);

    const result = await open({
      directory: false,
      multiple: false,
      title: t("chat_attach_image"),
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
        },
      ],
    });

    if (typeof result !== "string") {
      return;
    }

    const bytes = await readFileBinary(result);
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      onComposerErrorChange(t("chat_attachment_image_too_large"));
      return;
    }

    const mimeType = detectImageMimeType(result);
    if (!mimeType) {
      onComposerErrorChange(t("chat_attachment_image_unsupported"));
      return;
    }

    onAttachmentsChange(
      upsertAttachment(attachments, {
        id: buildAttachmentId(),
        kind: "image",
        name: getFileName(result),
        path: result,
        mimeType,
        imageDataUrl: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
      })
    );
  }

  function handleSend() {
    if (!canSend) return;
    // The hook clears composerText, attachments and composerError after processing
    onSend({ text: composerText, attachments, mode });
    textareaRef.current?.focus();
  }

  function handleRemoveAttachment(id: string) {
    onAttachmentsChange(attachments.filter((attachment) => attachment.id !== id));
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const modeOptions: Array<{ id: ChatMode; label: string; icon: typeof AgentIcon }> = [
    { id: "agent", label: t("chat_mode_agent"), icon: AgentIcon },
    { id: "plan", label: t("chat_mode_plan"), icon: PlanIcon },
    { id: "ask", label: t("chat_mode_ask"), icon: AskIcon },
  ];

  const activeMode = modeOptions.find((option) => option.id === mode) ?? modeOptions[2];
  const ActiveModeIcon = activeMode.icon;

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="px-3 pt-3">
          <textarea
            ref={textareaRef}
            value={composerText}
            onChange={(event) => onComposerTextChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat_placeholder_compose")}
            rows={1}
            className="min-h-[56px] w-full resize-none overflow-y-auto bg-transparent text-[13px] leading-6 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/72 outline-none"
            style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
          />
        </div>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)]/80 px-3 py-1.5 text-xs text-[var(--app-text)] transition-colors hover:border-[var(--app-text-muted)]/40 hover:bg-[var(--app-surface-alt)]/70"
                title={t("chat_attachment_remove")}
              >
                {attachment.kind === "image" ? (
                  <ImageIcon className="h-3.5 w-3.5 text-amber-300" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 text-sky-300" />
                )}
                <span className="max-w-[170px] truncate">{attachment.name}</span>
                <span className="text-[var(--app-text-muted)]/75">x</span>
              </button>
            ))}
          </div>
        )}

        {composerError && (
          <p className="px-4 pb-2 text-xs text-red-300">{composerError}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--app-border)] px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <div ref={attachMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAttachMenuOpen((current) => !current)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
                title={t("chat_attach")}
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>

              {attachMenuOpen && (
                <div className="absolute bottom-full left-0 z-20 mb-2 min-w-[164px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
                  <MenuActionButton
                    icon={FileIcon}
                    label={t("chat_attach_file")}
                    onClick={() => {
                      void handleAttachFile();
                    }}
                  />
                  <MenuActionButton
                    icon={ImageIcon}
                    label={t("chat_attach_image")}
                    onClick={() => {
                      void handleAttachImage();
                    }}
                  />
                </div>
              )}
            </div>

            {selectedModel?.supportsTools && (
              <CapabilityPill
                icon={ToolIcon}
                label={t("chat_capability_tools")}
                tone="sky"
              />
            )}
            {selectedModel?.supportsThinking && (
              <CapabilityPill
                icon={ThinkIcon}
                label={t("chat_capability_think")}
                tone="blue"
              />
            )}
            {selectedModel?.supportsVision && (
              <CapabilityPill
                icon={EyeIcon}
                label={t("chat_capability_vision")}
                tone="amber"
              />
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <div ref={modeMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setModeMenuOpen((current) => !current)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 text-xs text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface-alt)]"
                title={t("chat_mode_select")}
              >
                <ActiveModeIcon className="h-3.5 w-3.5 text-[var(--app-text-muted)]" />
                <span>{activeMode.label}</span>
                <ChevronDownIcon className="h-3.5 w-3.5 text-[var(--app-text-muted)]" />
              </button>

              {modeMenuOpen && (
                <div className="absolute bottom-full right-0 z-20 mb-2 min-w-[164px] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
                  {modeOptions.map((option) => (
                    <MenuActionButton
                      key={option.id}
                      icon={option.icon}
                      label={option.label}
                      selected={option.id === mode}
                      onClick={() => {
                        onModeChange(option.id);
                        setModeMenuOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <ChatModelSelector
              models={models}
              selectedModelId={selectedModelId}
              onSelect={onSelectModel}
              className="h-7 max-w-[170px] rounded-md border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 text-xs"
            />

            <button
              type="button"
              onClick={handleSend}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!canSend}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--app-text)] text-[var(--app-bg)] transition-all hover:opacity-92 disabled:opacity-35"
              title={t("chat_send")}
            >
              <SendArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof ToolIcon;
  label: string;
  tone: "sky" | "blue" | "amber";
}) {
  const toneClasses: Record<typeof tone, string> = {
    sky: "border-sky-400/30 bg-sky-500/12 text-sky-100",
    blue: "border-blue-400/30 bg-blue-500/12 text-blue-100",
    amber: "border-amber-400/30 bg-amber-500/14 text-amber-100",
  };

  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded border px-2 text-[11px] ${toneClasses[tone]}`}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </span>
  );
}

function MenuActionButton({
  icon: Icon,
  label,
  onClick,
  selected = false,
}: {
  icon: typeof ToolIcon;
  label: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
        selected
          ? "bg-[var(--app-surface-alt)] text-[var(--app-text)]"
          : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      {selected && <CheckIcon className="ml-auto h-3.5 w-3.5" />}
    </button>
  );
}

function upsertAttachment(
  current: ChatAttachment[],
  next: ChatAttachment
): ChatAttachment[] {
  const withoutDuplicate = current.filter((attachment) => attachment.path !== next.path);
  return [...withoutDuplicate, next];
}

function buildAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getFileName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || path;
}

function detectImageMimeType(path: string): string | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}
