import OpenAI from "openai";
import type { LLMProvider, StreamCompleteOptions } from "../types";

const DEFAULT_MODEL = "gpt-4o";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const openaiProvider: LLMProvider = {
  name: "openai",
  async streamComplete({ system, messages, maxTokens = 1024, onToken, signal }: StreamCompleteOptions) {
    const stream = getClient().chat.completions.stream(
      {
        model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
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
