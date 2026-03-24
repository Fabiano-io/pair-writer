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
import type { ChatSettings, ChatModelCatalogEntry, ChatProvider } from "../settings/settingsDefaults";
import { loadChatSettings } from "./chatSettings";
import { streamChatMessage } from "./chatService";
import { getApiKey } from "./chatCredentials";
import { resolveDefaultChatModelId, resolvePreferredEnabledModelId } from "./chatModelDefaults";
import { dispatchCanvasApply, type CanvasApplyPayload } from "../document/editorCommandEvents";
import { CANVAS_SURGICAL_PROMPT, CANVAS_CREATIVE_PROMPT } from "./canvasSystemPrompt";
import { parseCanvasDiff } from "./canvasParser";
import { classifyIntent } from "./canvasIntentClassifier";

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
  /** Current document content (markdown).  Provided when Canvas mode is active
   *  so that the system prompt can include the full document for editing. */
  documentContent?: string;
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
  documentContent = "",
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
    const cachedState = cacheRef.current[key] ?? DEFAULT_DOCUMENT_CHAT_STATE;

    if (!chatSettings) {
      setDocState(cachedState);
      return;
    }

    const defaultModelId = resolveDefaultChatModelId(
      chatSettings.models,
      chatSettings.provider,
      chatSettings.defaultChatModelId
    );
    const selectedModelId = resolvePreferredEnabledModelId(
      chatSettings.models,
      cachedState.selectedModelId,
      defaultModelId
    );
    const nextState =
      cachedState.selectedModelId === selectedModelId
        ? cachedState
        : {
            ...cachedState,
            selectedModelId,
          };

    cacheRef.current[key] = nextState;
    setDocState(nextState);
  }, [chatSettings, documentId]);

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

      // Classify canvas intent from the user command before the async chain
      const isCanvasMode = draft.mode === "plan" && documentContent.trim().length > 0;
      const intent = isCanvasMode ? classifyIntent(trimmed) : ("surgical" as const);
      console.log("[Canvas] intent:", intent, "| comando:", trimmed);
      const canvasBasePrompt =
        intent === "creative" ? CANVAS_CREATIVE_PROMPT : CANVAS_SURGICAL_PROMPT;

      // Captured inside the .then() so .finally() can look up the finished message
      let capturedAssistantMsgId = "";

      resolveEndpointAndKey()
        .then(({ endpointUrl, apiKey }) => {
          if (reqId !== requestIdsByDocRef.current[key]) return;

          // Build the messages array from the cache (already includes userMsg)
          const cachedMsgs = cacheRef.current[key]?.messages ?? [userMsg];

          const apiMessages = [
            {
              role: "system",
              content: isCanvasMode
                ? buildCanvasSystemInstruction(documentContent, selectedEntry, canvasBasePrompt)
                : buildModeSystemInstruction(draft.mode, selectedEntry),
            },
            ...cachedMsgs.map((message) => ({
              role: message.role,
              content: buildApiMessageContent(
                message,
                selectedEntry.supportsVision === true
              ),
            })),
          ];

          // ID for the assistant message we will stream into
          const assistantMsgId = generateId();
          // Capture the ID so the .finally() handler can find the final message
          capturedAssistantMsgId = assistantMsgId;
          let firstChunk = true;

          const applyDelta = (field: "content" | "thinkingContent", delta: string) => {
            if (reqId !== requestIdsByDocRef.current[key]) return;

            const prev = cacheRef.current[key] ?? DEFAULT_DOCUMENT_CHAT_STATE;

            let next: DocumentChatPersistedState;

            if (firstChunk && field === "content") {
              // First content token: add the assistant message to the list
              firstChunk = false;
              const assistantMsg: ChatMessage = {
                id: assistantMsgId,
                role: "assistant",
                content: delta,
                contentKind: isCanvasMode ? "canvas_edit" : undefined,
                timestamp: Date.now(),
              };
              next = { ...prev, messages: [...prev.messages, assistantMsg] };
            } else {
              // Subsequent tokens: append to the existing message
              next = {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content:
                          field === "content" ? m.content + delta : m.content,
                        thinkingContent:
                          field === "thinkingContent"
                            ? (m.thinkingContent ?? "") + delta
                            : m.thinkingContent,
                      }
                    : m
                ),
              };
            }

            cacheRef.current[key] = next;
            if (documentIdRef.current === sendingDocId) {
              setDocState(next);
            }
          };

          return streamChatMessage(endpointUrl, modelId, apiMessages, apiKey, {
            onChunk: (chunk) => applyDelta("content", chunk),
            onThinking: (chunk) => applyDelta("thinkingContent", chunk),
          });
        })
        .catch((err) => {
          if (reqId !== requestIdsByDocRef.current[key]) return;

          const reason =
            typeof err === "string"
              ? err
              : err instanceof Error
                ? err.message
                : "Unknown error";

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

          // Canvas mode: dispatch the finished response to the editor for
          // diff-based application with animated highlight marks.
          if (
            draft.mode === "plan" &&
            sendingDocId &&
            capturedAssistantMsgId &&
            documentContent.trim().length > 0
          ) {
            const finalMsgs = cacheRef.current[key]?.messages ?? [];
            const assistantMsg = finalMsgs.find(
              (m) => m.id === capturedAssistantMsgId
            );
            if (assistantMsg?.content?.trim()) {
              let canvasPayload: CanvasApplyPayload;
              if (intent === "creative") {
                const sanitized = assistantMsg.content.trim()
                  .replace(/^---\n?/m, "")
                  .replace(/\n?---$/m, "")
                  .replace(/^```[\w]*\n?/m, "")
                  .replace(/\n?```$/m, "")
                  .trim();
                console.log("[Canvas Creative] Retorno do modelo:", sanitized);
                canvasPayload = {
                  documentId: sendingDocId,
                  newContent: sanitized,
                  canvasDiff: {
                    summary: "Reescrita criativa aplicada",
                    correctedDocument: sanitized,
                    changes: [],
                    intent: "creative",
                  },
                  anchorStrategy: "dmp-only",
                };
              } else {
                try {
                  const diff = parseCanvasDiff(assistantMsg.content.trim());
                  diff.intent = "surgical";
                  console.log("[Canvas Surgical] intent:", intent);
                  console.log("[Canvas Surgical] changes:", JSON.stringify(diff.changes, null, 2));
                  console.log("[Canvas Surgical] correctedDocument:", diff.correctedDocument);
                  canvasPayload = {
                    documentId: sendingDocId,
                    newContent: diff.correctedDocument,
                    canvasDiff: diff,
                    anchorStrategy: resolveAnchorStrategy(selectedEntry.provider),
                  };
                } catch {
                  canvasPayload = {
                    documentId: sendingDocId,
                    newContent: assistantMsg.content.trim(),
                    canvasDiff: null,
                    anchorStrategy: "dmp-only",
                  };
                }
              }
              dispatchCanvasApply(canvasPayload);
            }
          }
        });
    },
    [isLoading, chatSettings, docState.selectedModelId, enabledModels, documentContent]
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

function buildCapabilityNotes(selectedModel: ChatModelCatalogEntry): string {
  return [
    selectedModel.supportsThinking ? "thinking enabled" : null,
    selectedModel.supportsVision ? "vision enabled" : null,
    selectedModel.supportsTools ? "tools enabled" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildModeSystemInstruction(
  mode: ChatDraftMessage["mode"],
  selectedModel: ChatModelCatalogEntry
): string {
  const capabilityNotes = buildCapabilityNotes(selectedModel);

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

function resolveAnchorStrategy(
  provider: ChatProvider
): "anchoring" | "dmp-only" {
  // Tier A: models that follow the JSON contract with high fidelity
  // — they return context.before/after with the ORIGINAL document text
  const tierA: ChatProvider[] = ["anthropic", "openai", "gemini"];
  return tierA.includes(provider) ? "anchoring" : "dmp-only";
}

function buildCanvasSystemInstruction(
  documentContent: string,
  selectedModel: ChatModelCatalogEntry,
  basePrompt: string = CANVAS_SURGICAL_PROMPT
): string {
  const docSection = [
    "",
    "## DOCUMENTO ATUAL",
    "---",
    documentContent,
    "---",
  ].join("\n");

  const capabilityNotes = buildCapabilityNotes(selectedModel);

  return basePrompt + docSection + (capabilityNotes ? "\n" + capabilityNotes : "");
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
