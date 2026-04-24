export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface TitanChatResponse {
  message: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export type TitanPersona =
  | "default"
  | "analyst"
  | "coder"
  | "researcher"
  | "strategist";
