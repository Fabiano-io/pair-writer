import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ChatModelCatalogEntry } from "../settings/settingsDefaults";
import { useTranslation } from "../settings/i18n/useTranslation";
import { readFileBinary, readFileContent } from "../project/projectAccess";
import {
  AttachIcon,
  EyeIcon,
  FileIcon,
  ImageIcon,
  MicrophoneIcon,
  SendArrowIcon,
  ThinkIcon,
  ToolIcon,
} from "./ChatIcons";
import { ChatModelDropdown } from "./ChatModelDropdown";
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

const MAX_TEXTAREA_HEIGHT = 280;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedModel =
    models.find((m) => m.id === selectedModelId) ?? models[0] ?? null;

  const canSend =
    !isLoading &&
    selectedModel !== null &&
    (composerText.trim().length > 0 || attachments.length > 0);

  const composerView = mode === "ask" ? "chat" : "canvas";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [composerText]);

  async function handleAttachFile() {
    onComposerErrorChange(null);
    const result = await open({
      directory: false,
      multiple: false,
      title: t("chat_attach_file"),
    });
    if (typeof result !== "string") return;
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
    onComposerErrorChange(null);
    const result = await open({
      directory: false,
      multiple: false,
      title: t("chat_attach_image"),
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"] }],
    });
    if (typeof result !== "string") return;
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
    onSend({ text: composerText, attachments, mode });
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleRemoveAttachment(id: string) {
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  }

  const hasCapabilities =
    selectedModel?.supportsTools ||
    selectedModel?.supportsThinking ||
    selectedModel?.supportsVision;

  return (
    <div className="px-3 pb-3 pt-2">
      <div className="overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)]">

        {/* ── Top bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-border)] px-3 py-2">

          {/* Left: model selector + capability icons */}
          <div className="flex items-center gap-2">
            <ChatModelDropdown
              models={models}
              selectedModelId={selectedModelId}
              onSelect={onSelectModel}
            />

            {hasCapabilities && (
              <div className="flex items-center gap-0.5 border-l border-[var(--app-border)] pl-2">
                {selectedModel?.supportsTools && (
                  <CapabilityIconBtn
                    icon={ToolIcon}
                    label={t("chat_capability_tools")}
                    iconStyle={{ transform: "scale(0.9)" }}
                  />
                )}
                {selectedModel?.supportsThinking && (
                  <CapabilityIconBtn
                    icon={ThinkIcon}
                    label={t("chat_capability_think")}
                    iconStyle={{ transform: "scale(0.98)" }}
                  />
                )}
                {selectedModel?.supportsVision && (
                  <CapabilityIconBtn
                    icon={EyeIcon}
                    label={t("chat_capability_vision")}
                    iconStyle={{ transform: "scale(0.94)" }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right: mode tab switcher */}
          <div className="flex items-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
            <ComposerViewButton
              active={composerView === "chat"}
              label={t("chat_mode_chat")}
              onClick={() => onModeChange("ask")}
            />
            <ComposerViewButton
              active={composerView === "canvas"}
              label={t("chat_mode_canvas")}
              onClick={() => onModeChange("plan")}
            />
          </div>
        </div>

        {/* ── Textarea ── */}
        <div className="px-4 pb-3 pt-4">
          <textarea
            ref={textareaRef}
            value={composerText}
            onChange={(e) => onComposerTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat_placeholder_compose")}
            rows={1}
            className="min-h-[52px] w-full resize-none overflow-y-auto bg-transparent text-[14px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/45 outline-none"
            style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
          />
        </div>

        {/* ── Attachment chips ── */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {attachments.map((att) => (
              <button
                key={att.id}
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-1 text-xs text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)]"
                title={t("chat_attachment_remove")}
              >
                {att.kind === "image" ? (
                  <ImageIcon className="h-3.5 w-3.5 text-amber-300" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 text-sky-300" />
                )}
                <span className="max-w-[160px] truncate">{att.name}</span>
                <span className="text-[var(--app-text-muted)]/60">×</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Composer error ── */}
        {composerError && (
          <p className="px-4 pb-2 text-xs text-red-300">{composerError}</p>
        )}

        {/* ── Bottom bar ── */}
        <div className="flex items-center justify-between border-t border-[var(--app-border)] px-3 py-2.5">

          {/* Attach buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleAttachFile()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-transparent text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
              title={t("chat_attach_file")}
            >
              <AttachIcon className="h-5 w-5" style={{ transform: "scale(0.88)" }} />
            </button>
            <button
              type="button"
              onClick={() => void handleAttachImage()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-transparent text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
              title={t("chat_attach_image")}
            >
              <ImageIcon className="h-[21px] w-[21px]" style={{ transform: "scale(0.96)" }} />
            </button>
            <button
              type="button"
              onClick={() => undefined}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-transparent text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
              title={t("chat_voice_input")}
            >
              <MicrophoneIcon className="h-[21px] w-[21px]" style={{ transform: "scale(0.93)" }} />
            </button>
          </div>

          {/* Shortcut hint + Send */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium tracking-tight text-[var(--app-text-muted)]/50">
              ↵ ENTER
            </span>
            <button
              type="button"
              onClick={handleSend}
              onMouseDown={(e) => e.preventDefault()}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-[8px] bg-[var(--app-surface-alt)] px-4 py-1.5 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:bg-[var(--app-hover-bg)] disabled:opacity-35"
              title={t("chat_send")}
            >
              <span>{t("chat_send")}</span>
              <SendArrowIcon className="h-3.5 w-3.5" style={{ strokeWidth: 2.5 }} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function CapabilityIconBtn({
  icon: Icon,
  label,
  iconStyle,
}: {
  icon: typeof ToolIcon;
  label: string;
  iconStyle?: CSSProperties;
}) {
  return (
    <button
      type="button"
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
    >
      <Icon className="h-[22px] w-[22px]" style={iconStyle} />
    </button>
  );
}

function ComposerViewButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[8px] px-5 py-1.5 text-[12px] font-semibold transition-colors ${
        active
          ? "bg-[var(--app-surface-alt)] text-[var(--app-text)]"
          : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
      }`}
    >
      {label}
    </button>
  );
}

function upsertAttachment(
  current: ChatAttachment[],
  next: ChatAttachment
): ChatAttachment[] {
  const withoutDuplicate = current.filter((a) => a.path !== next.path);
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
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
