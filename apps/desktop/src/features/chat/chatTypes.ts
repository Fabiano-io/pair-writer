export type ChatMode = "agent" | "plan" | "ask";

export interface ChatAttachment {
  id: string;
  kind: "file" | "image";
  name: string;
  path: string;
  mimeType?: string;
  textContent?: string;
  imageDataUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinkingContent?: string;
  attachments?: ChatAttachment[];
  mode?: ChatMode;
  timestamp: number;
}

export interface ChatCompletionResult {
  content: string;
  thinkingContent: string | null;
}

export interface ChatMessageContentTextPart {
  type: "text";
  text: string;
}

export interface ChatMessageContentImagePart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

export type ChatMessageContentPart =
  | ChatMessageContentTextPart
  | ChatMessageContentImagePart;

export interface ChatDraftMessage {
  text: string;
  attachments: ChatAttachment[];
  mode: ChatMode;
}

/** All chat state that belongs to a specific document. Persisted in memory while the app is open. */
export interface DocumentChatPersistedState {
  messages: ChatMessage[];
  selectedModelId: string | null;
  composerText: string;
  mode: ChatMode;
  attachments: ChatAttachment[];
  /** Validation errors from the file/image picker. */
  composerError: string | null;
  /** API/network error from the last send attempt (shown as the red banner). */
  apiError: string | null;
}

export const DEFAULT_DOCUMENT_CHAT_STATE: DocumentChatPersistedState = {
  messages: [],
  selectedModelId: null,
  composerText: "",
  mode: "ask",
  attachments: [],
  composerError: null,
  apiError: null,
};
