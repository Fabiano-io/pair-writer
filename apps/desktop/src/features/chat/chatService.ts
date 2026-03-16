import { Channel, invoke } from "@tauri-apps/api/core";
import type { ChatCompletionResult, ChatMessageContentPart } from "./chatTypes";

interface MessagePayload {
  role: string;
  content: string | ChatMessageContentPart[];
}

/** Events emitted by the Rust stream_chat_message command. */
type StreamEvent =
  | { type: "chunk"; content: string }
  | { type: "thinking"; content: string }
  | { type: "end" }
  | { type: "error"; message: string };

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onThinking: (content: string) => void;
}

/**
 * Non-streaming fallback. Returns the full response in one shot.
 * Kept for potential future use.
 */
export async function sendChatMessage(
  endpointUrl: string,
  model: string,
  messages: MessagePayload[],
  apiKey?: string,
  temperature?: number
): Promise<ChatCompletionResult> {
  return invoke<ChatCompletionResult>("send_chat_message", {
    endpointUrl,
    apiKey: apiKey || null,
    model,
    messages,
    temperature: temperature ?? null,
  });
}

/**
 * Streaming variant. Calls `onChunk` / `onThinking` incrementally as tokens
 * arrive, then resolves when the stream is complete.
 */
export function streamChatMessage(
  endpointUrl: string,
  model: string,
  messages: MessagePayload[],
  apiKey: string | undefined,
  callbacks: StreamCallbacks,
  temperature?: number
): Promise<void> {
  const channel = new Channel<StreamEvent>();

  channel.onmessage = (event) => {
    if (event.type === "chunk") {
      callbacks.onChunk(event.content);
    } else if (event.type === "thinking") {
      callbacks.onThinking(event.content);
    }
    // "end" and "error" are handled via the Promise resolution/rejection below
  };

  return invoke<void>("stream_chat_message", {
    endpointUrl,
    apiKey: apiKey || null,
    model,
    messages,
    temperature: temperature ?? null,
    onEvent: channel,
  });
}
