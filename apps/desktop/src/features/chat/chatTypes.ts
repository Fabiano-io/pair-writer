export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinkingContent?: string;
  timestamp: number;
}

export interface ChatCompletionResult {
  content: string;
  thinkingContent: string | null;
}
