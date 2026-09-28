import OpenAI from "openai";
import type { LLMProvider, StreamCompleteOptions } from "../types";

interface OpenAICompatibleConfig {
  name: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  /** Omit for api.openai.com. Read lazily so env changes are picked up. */
  baseURL?: () => string | undefined;
  /** Provider/model-specific request fields, e.g. reasoning effort. */
  extraParams?: (model: string) => { reasoning_effort?: "low" | "medium" | "high" };
}

/**
 * One implementation for every provider that speaks the OpenAI Chat
 * Completions API: OpenAI itself, plus Gemini and Groq through their
 * OpenAI-compatible endpoints.
 */
export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): LLMProvider {
  let client: OpenAI | null = null;

  function getClient(): OpenAI {
    if (!client) {
      const baseURL = config.baseURL?.();
      client = new OpenAI({ apiKey: process.env[config.apiKeyEnv], ...(baseURL ? { baseURL } : {}) });
    }
    return client;
  }

  return {
    name: config.name,
    async streamComplete({ system, messages, maxTokens = 1024, onToken, signal }: StreamCompleteOptions) {
      const model = process.env[config.modelEnv] || config.defaultModel;
      const stream = getClient().chat.completions.stream(
        {
          model,
          ...config.extraParams?.(model),
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            ...messages.map((m) => ({ role: m.role, content: m.content }) as const),
          ],
        },
        { signal },
      );

      stream.on("content", (delta) => onToken(delta));
      const fullText = (await stream.finalContent()) ?? "";
      return { fullText };
    },
  };
}
