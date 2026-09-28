import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, StreamCompleteOptions } from "../types";

// Configurable because model catalogs move fast; this default matches what
// was current when this project was built. Override with ANTHROPIC_MODEL if
// your account uses a different id.
const DEFAULT_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const anthropicProvider: LLMProvider = {
  name: "anthropic",
  async streamComplete({ system, messages, maxTokens = 1024, onToken, signal }: StreamCompleteOptions) {
    const stream = getClient().messages.stream(
      {
        model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      { signal },
    );

    stream.on("text", (delta) => onToken(delta));

    const fullText = await stream.finalText();
    return { fullText };
  },
};
