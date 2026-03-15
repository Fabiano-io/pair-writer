import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./chatTypes";
import type { ChatSettings, ChatModelCatalogEntry } from "../settings/settingsDefaults";
import { loadChatSettings } from "./chatSettings";
import { sendChatMessage } from "./chatService";
import { getApiKey } from "./chatCredentials";

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface UseChatConversationOptions {
  configVersion: number;
}

interface UseChatConversationReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  models: ChatModelCatalogEntry[];
  selectedModelId: string | null;
  setSelectedModelId: (id: string) => void;
  sendMessage: (text: string) => void;
  clearConversation: () => void;
  dismissError: () => void;
}

export function useChatConversation({
  configVersion,
}: UseChatConversationOptions): UseChatConversationReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const abortRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadChatSettings()
      .then((settings) => {
        if (cancelled) return;
        setChatSettings(settings);

        // Auto-select the first enabled model for the active provider
        if (!selectedModelId) {
          const enabledForProvider = settings.models.filter(
            (m) => m.provider === settings.provider && m.enabled
          );
          if (enabledForProvider.length > 0) {
            setSelectedModelId(enabledForProvider[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setChatSettings(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configVersion]);

  const enabledModels = chatSettings
    ? chatSettings.models.filter((m) => m.enabled)
    : [];

  const sendUserMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || !chatSettings) return;

      const selectedEntry = enabledModels.find(
        (m) => m.id === selectedModelId
      );
      if (!selectedEntry) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);
      abortRef.current = false;

      const provider = selectedEntry.provider;
      const modelId = selectedEntry.modelId;

      const resolveEndpointAndKey = async (): Promise<{
        endpointUrl: string;
        apiKey?: string;
      }> => {
        if (provider === "lmStudio") {
          const key = await getApiKey("lmStudio").catch(() => "");
          return {
            endpointUrl: chatSettings.lmStudio.endpointUrl,
            apiKey: key || undefined,
          };
        }
        if (provider === "openAiCompatible") {
          const key = await getApiKey("openAiCompatible").catch(() => "");
          return {
            endpointUrl: chatSettings.openAiCompatible.endpointUrl,
            apiKey: key || undefined,
          };
        }

        // Cloud providers: use their standard base URLs
        const baseUrls: Record<string, string> = {
          openai: "https://api.openai.com",
          anthropic: "https://api.anthropic.com",
          gemini:
            "https://generativelanguage.googleapis.com/v1beta/openai",
        };
        const url = baseUrls[provider] ?? "";
        const key = await getApiKey(provider).catch(() => "");
        return { endpointUrl: url, apiKey: key || undefined };
      };

      resolveEndpointAndKey()
        .then(async ({ endpointUrl, apiKey }) => {
          if (abortRef.current) return;

          const apiMessages = [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          }));

          const result = await sendChatMessage(
            endpointUrl,
            modelId,
            apiMessages,
            apiKey
          );

          if (abortRef.current) return;

          const assistantMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: result.content,
            thinkingContent: result.thinkingContent ?? undefined,
            timestamp: Date.now(),
          };

          setMessages((prev) => [...prev, assistantMsg]);
        })
        .catch((err) => {
          if (abortRef.current) return;
          const reason =
            typeof err === "string"
              ? err
              : err instanceof Error
                ? err.message
                : "Unknown error";
          setError(reason);
        })
        .finally(() => {
          if (!abortRef.current) setIsLoading(false);
        });
    },
    [isLoading, chatSettings, selectedModelId, enabledModels, messages]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    models: enabledModels,
    selectedModelId,
    setSelectedModelId,
    sendMessage: sendUserMessage,
    clearConversation,
    dismissError,
  };
}
