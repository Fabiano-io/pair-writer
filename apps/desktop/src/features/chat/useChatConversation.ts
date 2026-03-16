import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatAttachment,
  ChatDraftMessage,
  ChatMessage,
  ChatMessageContentPart,
  ChatMode,
  DocumentChatPersistedState,
} from "./chatTypes";
import { DEFAULT_DOCUMENT_CHAT_STATE } from "./chatTypes";
import type { ChatSettings, ChatModelCatalogEntry } from "../settings/settingsDefaults";
import { loadChatSettings } from "./chatSettings";
import { sendChatMessage } from "./chatService";
import { getApiKey } from "./chatCredentials";

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Stable key for the "no document" case
const NO_DOC_KEY = "__no_doc__";

function docKey(documentId: string | null): string {
  return documentId ?? NO_DOC_KEY;
}

interface UseChatConversationOptions {
  configVersion: number;
  documentId: string | null;
}

interface UseChatConversationReturn {
  // Per-document state
  messages: ChatMessage[];
  selectedModelId: string | null;
  setSelectedModelId: (id: string) => void;
  composerText: string;
  setComposerText: (text: string) => void;
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  attachments: ChatAttachment[];
  setAttachments: (attachments: ChatAttachment[]) => void;
  composerError: string | null;
  setComposerError: (error: string | null) => void;
  // Derived / transient state
  isLoading: boolean;
  error: string | null;
  models: ChatModelCatalogEntry[];
  selectedModel: ChatModelCatalogEntry | null;
  // Actions
  sendMessage: (draft: ChatDraftMessage) => void;
  clearConversation: () => void;
  dismissError: () => void;
}

export function useChatConversation({
  configVersion,
  documentId,
}: UseChatConversationOptions): UseChatConversationReturn {
  const [docState, setDocState] = useState<DocumentChatPersistedState>(DEFAULT_DOCUMENT_CHAT_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);

  // In-memory cache: docKey → full per-document chat state
  const cacheRef = useRef<Record<string, DocumentChatPersistedState>>({});
  // Per-document loading flags — used to restore loading state on tab switch-back
  const loadingByDocRef = useRef<Record<string, boolean>>({});
  // Per-document request IDs — only incremented when a new send starts on that doc.
  // Switching documents never touches other documents' IDs, so background requests
  // keep running and their callbacks remain valid.
  const requestIdsByDocRef = useRef<Record<string, number>>({});
  // Synchronous ref to current documentId — safe to read inside async callbacks
  const documentIdRef = useRef(documentId);
  documentIdRef.current = documentId;

  // Reload AI settings whenever the config changes
  useEffect(() => {
    let cancelled = false;
    loadChatSettings()
      .then((settings) => {
        if (cancelled) return;
        setChatSettings(settings);

        // Auto-select the first enabled model for the active provider if none chosen yet
        setDocState((prev) => {
          if (prev.selectedModelId !== null) return prev;
          const first = settings.models.find(
            (m) => m.provider === settings.provider && m.enabled
          );
          if (!first) return prev;
          const next = { ...prev, selectedModelId: first.id };
          const key = docKey(documentIdRef.current);
          cacheRef.current[key] = next;
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setChatSettings(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configVersion]);

  // Switch to the target document's cached state.
  // In-flight requests from the previous document are NOT cancelled — they continue
  // in the background, write their results to cacheRef, and only update React state
  // if the user is still on (or returns to) that document.
  useEffect(() => {
    const key = docKey(documentId);
    setIsLoading(loadingByDocRef.current[key] ?? false);
    setDocState(cacheRef.current[key] ?? DEFAULT_DOCUMENT_CHAT_STATE);
  }, [documentId]);

  /** Updates the current document's state and writes through to the cache. */
  const updateDocState = useCallback(
    (
      patch:
        | Partial<DocumentChatPersistedState>
        | ((prev: DocumentChatPersistedState) => Partial<DocumentChatPersistedState>)
    ) => {
      setDocState((prev) => {
        const resolved = typeof patch === "function" ? patch(prev) : patch;
        const next = { ...prev, ...resolved };
        cacheRef.current[docKey(documentIdRef.current)] = next;
        return next;
      });
    },
    []
  );

  const enabledModels = chatSettings
    ? chatSettings.models.filter((m) => m.enabled)
    : [];

  const selectedModel =
    enabledModels.find((m) => m.id === docState.selectedModelId) ?? null;

  const sendUserMessage = useCallback(
    (draft: ChatDraftMessage) => {
      const trimmed = draft.text.trim();
      if (
        (trimmed.length === 0 && draft.attachments.length === 0) ||
        isLoading ||
        !chatSettings
      ) {
        return;
      }

      const selectedEntry = enabledModels.find((m) => m.id === docState.selectedModelId);
      if (!selectedEntry) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        attachments: draft.attachments,
        mode: draft.mode,
        timestamp: Date.now(),
      };

      // Snapshot the sending context — these are closed over in every async callback
      const sendingDocId = documentIdRef.current;
      const key = docKey(sendingDocId);

      // Assign a new per-document request ID so that if another send starts on the
      // same document it can supersede this one.
      const reqId = (requestIdsByDocRef.current[key] ?? 0) + 1;
      requestIdsByDocRef.current[key] = reqId;

      // Mark this document as loading
      loadingByDocRef.current[key] = true;

      // Add the user message and clear the composer
      setDocState((prev) => {
        const next: DocumentChatPersistedState = {
          ...prev,
          messages: [...prev.messages, userMsg],
          composerText: "",
          attachments: [],
          composerError: null,
          apiError: null,
        };
        cacheRef.current[key] = next;
        return next;
      });
      setIsLoading(true);

      const provider = selectedEntry.provider;
      const modelId = selectedEntry.modelId;

      const resolveEndpointAndKey = async (): Promise<{
        endpointUrl: string;
        apiKey?: string;
      }> => {
        if (provider === "lmStudio") {
          const k = await getApiKey("lmStudio").catch(() => "");
          return { endpointUrl: chatSettings.lmStudio.endpointUrl, apiKey: k || undefined };
        }
        if (provider === "openAiCompatible") {
          const k = await getApiKey("openAiCompatible").catch(() => "");
          return {
            endpointUrl: chatSettings.openAiCompatible.endpointUrl,
            apiKey: k || undefined,
          };
        }
        const baseUrls: Record<string, string> = {
          openai: "https://api.openai.com",
          anthropic: "https://api.anthropic.com",
          gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
        };
        const k = await getApiKey(provider).catch(() => "");
        return { endpointUrl: baseUrls[provider] ?? "", apiKey: k || undefined };
      };

      resolveEndpointAndKey()
        .then(async ({ endpointUrl, apiKey }) => {
          // A newer send on the same document supersedes this one
          if (reqId !== requestIdsByDocRef.current[key]) return;

          // Read the messages from the cache (already includes userMsg)
          const cachedMsgs =
            cacheRef.current[key]?.messages ?? [userMsg];

          const apiMessages = [
            {
              role: "system",
              content: buildModeSystemInstruction(draft.mode, selectedEntry),
            },
            ...cachedMsgs.map((message) => ({
              role: message.role,
              content: buildApiMessageContent(
                message,
                selectedEntry.supportsVision === true
              ),
            })),
          ];

          const result = await sendChatMessage(endpointUrl, modelId, apiMessages, apiKey);

          if (reqId !== requestIdsByDocRef.current[key]) return;

          const assistantMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: result.content,
            thinkingContent: result.thinkingContent ?? undefined,
            timestamp: Date.now(),
          };

          // Always write to the cache — the user may have switched away
          const prev = cacheRef.current[key] ?? DEFAULT_DOCUMENT_CHAT_STATE;
          const next = { ...prev, messages: [...prev.messages, assistantMsg] };
          cacheRef.current[key] = next;

          // Only update visible React state if the user is currently on this document
          if (documentIdRef.current === sendingDocId) {
            setDocState(next);
          }
        })
        .catch((err) => {
          if (reqId !== requestIdsByDocRef.current[key]) return;

          const reason =
            typeof err === "string"
              ? err
              : err instanceof Error
                ? err.message
                : "Unknown error";

          // Always write the error to the cache
          const prev = cacheRef.current[key] ?? DEFAULT_DOCUMENT_CHAT_STATE;
          const next = { ...prev, apiError: reason };
          cacheRef.current[key] = next;

          if (documentIdRef.current === sendingDocId) {
            setDocState(next);
          }
        })
        .finally(() => {
          if (reqId !== requestIdsByDocRef.current[key]) return;
          loadingByDocRef.current[key] = false;
          if (documentIdRef.current === sendingDocId) {
            setIsLoading(false);
          }
        });
    },
    [isLoading, chatSettings, docState.selectedModelId, enabledModels]
  );

  const clearConversation = useCallback(() => {
    updateDocState({ messages: [], composerError: null, apiError: null });
  }, [updateDocState]);

  const dismissError = useCallback(() => {
    updateDocState({ apiError: null });
  }, [updateDocState]);

  return {
    messages: docState.messages,
    selectedModelId: docState.selectedModelId,
    setSelectedModelId: (id) => updateDocState({ selectedModelId: id }),
    composerText: docState.composerText,
    setComposerText: (text) => updateDocState({ composerText: text }),
    mode: docState.mode,
    setMode: (mode) => updateDocState({ mode }),
    attachments: docState.attachments,
    setAttachments: (attachments) => updateDocState({ attachments }),
    composerError: docState.composerError,
    setComposerError: (composerError) => updateDocState({ composerError }),
    isLoading,
    error: docState.apiError,
    models: enabledModels,
    selectedModel,
    sendMessage: sendUserMessage,
    clearConversation,
    dismissError,
  };
}

function buildModeSystemInstruction(
  mode: ChatDraftMessage["mode"],
  selectedModel: ChatModelCatalogEntry
): string {
  const capabilityNotes = [
    selectedModel.supportsThinking ? "thinking enabled" : null,
    selectedModel.supportsVision ? "vision enabled" : null,
    selectedModel.supportsTools ? "tools enabled" : null,
  ]
    .filter(Boolean)
    .join(", ");

  const baseInstruction =
    mode === "agent"
      ? "Work in agent mode. Be proactive, propose next actions, and structure the answer so the user can execute it immediately."
      : mode === "plan"
        ? "Work in plan mode. Start with a concise plan or checklist, then expand only where useful."
        : "Work in ask mode. Answer directly, stay concise, and avoid unnecessary extra steps.";

  return capabilityNotes
    ? `${baseInstruction} Selected model capabilities: ${capabilityNotes}.`
    : baseInstruction;
}

function buildApiMessageContent(
  message: ChatMessage,
  canUseVision: boolean
): string | ChatMessageContentPart[] {
  const text = message.content.trim();
  const attachments = message.attachments ?? [];

  if (attachments.length === 0) return text;

  const parts: ChatMessageContentPart[] = [];

  if (text) parts.push({ type: "text", text });

  attachments.forEach((attachment) => {
    if (attachment.kind === "image") {
      if (attachment.imageDataUrl && canUseVision) {
        parts.push({ type: "text", text: `Attached image: ${attachment.name}` });
        parts.push({ type: "image_url", image_url: { url: attachment.imageDataUrl } });
        return;
      }
      parts.push({
        type: "text",
        text: `Attached image: ${attachment.name} (image reference only; visual bytes were not sent for this model).`,
      });
      return;
    }
    if (attachment.textContent?.trim()) {
      parts.push({
        type: "text",
        text: `Attached file: ${attachment.name}\n\n${attachment.textContent}`,
      });
      return;
    }
    parts.push({ type: "text", text: `Attached file: ${attachment.name}` });
  });

  if (parts.length === 1 && parts[0].type === "text") return parts[0].text;
  return parts;
}
