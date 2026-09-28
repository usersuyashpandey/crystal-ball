import type { StreamMode } from "@/lib/schemas";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamCompleteOptions {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  onToken: (delta: string) => void;
  signal: AbortSignal;
}

export interface LLMProvider {
  readonly name: string;
  streamComplete(opts: StreamCompleteOptions): Promise<{ fullText: string }>;
}

export interface CompletionResult {
  fullText: string;
  mode: StreamMode;
}
