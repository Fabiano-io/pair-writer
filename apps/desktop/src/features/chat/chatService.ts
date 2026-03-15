import { invoke } from "@tauri-apps/api/core";
import type { ChatCompletionResult } from "./chatTypes";

interface MessagePayload {
  role: string;
  content: string;
}

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
