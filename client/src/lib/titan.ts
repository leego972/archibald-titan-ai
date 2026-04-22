import type { ChatMessage, TitanChatResponse, TitanPersona } from "./titan.types";

const API_BASE =
  (import.meta as any).env?.VITE_TITAN_API_URL ??
  process.env["TITAN_API_URL"] ??
  "https://archibaldtitan.replit.app/api";

export type { ChatMessage, TitanChatResponse, TitanPersona };

export interface TitanChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  onStream?: (chunk: string) => void;
}

export interface TitanStatusResult {
  status: string;
  training: boolean;
  modelEndpoint: boolean;
  personas: string[];
  version: string;
}

export interface TitanPersonaResult {
  id: string;
  name: string;
  domain: string;
  greeting: string;
  ready: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`TitanAI API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

export async function titanChat(
  options: TitanChatOptions
): Promise<TitanChatResponse> {
  return request<TitanChatResponse>("/titan/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: options.messages,
      persona: "archibald",
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 2048,
    }),
  });
}

export async function titanStatus(): Promise<TitanStatusResult> {
  return request<TitanStatusResult>("/titan/status");
}

export async function titanPersona(): Promise<TitanPersonaResult> {
  return request<TitanPersonaResult>("/titan/persona?id=archibald");
}

export const TITAN_PERSONA = "archibald" as const;
