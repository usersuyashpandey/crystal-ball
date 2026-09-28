import type { LLMMessage, LLMProvider, CompletionResult } from "./types";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { mockProvider } from "./providers/mock";

export type { LLMMessage, CompletionResult };

const DEFAULT_TIMEOUT_MS = 8000;

function selectConfiguredProvider(): LLMProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return anthropicProvider;
  if (process.env.OPENAI_API_KEY) return openaiProvider;
  return null;
}

export interface StreamCompletionArgs {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  onToken?: (delta: string) => void;
  timeoutMs?: number;
}

/**
 * The single entry point every route handler calls. Implements the two
 * "Fallback design" requirements from the brief (§3) in one place:
 *
 *  - Every LLM call gets an 8s timeout (default; override per-call).
 *  - Failure or timeout never bubbles up as a raw error — it degrades to
 *    the offline mock provider, which produces a fast, context-grounded
 *    canned response instead of a blank or frozen panel. The caller finds
 *    out via `mode` ("live" | "mock" | "degraded") and can surface that in
 *    the UI, but the stream itself always completes normally.
 */
export async function streamCompletion({
  system,
  messages,
  maxTokens,
  onToken = () => {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: StreamCompletionArgs): Promise<CompletionResult> {
  const provider = selectConfiguredProvider();

  if (!provider) {
    const { fullText } = await mockProvider.streamComplete({
      system,
      messages,
      maxTokens,
      onToken,
      signal: new AbortController().signal,
    });
    return { fullText, mode: "mock" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("llm_timeout")), timeoutMs);
  let streamedAny = false;

  try {
    const { fullText } = await provider.streamComplete({
      system,
      messages,
      maxTokens,
      onToken: (delta) => {
        streamedAny = true;
        onToken(delta);
      },
      signal: controller.signal,
    });
    return { fullText, mode: "live" };
  } catch {
    // Graceful degradation: never let a timeout or provider error surface
    // as a raw 500 or a stream that just stops. Continue (or start) the
    // response with the offline mock provider's canned-but-grounded output.
    const notice = streamedAny
      ? "\n\n_[connection interrupted — finishing from an offline fallback]_\n\n"
      : "";
    if (notice) onToken(notice);

    const { fullText: fallbackText } = await mockProvider.streamComplete({
      system,
      messages,
      maxTokens,
      onToken,
      signal: new AbortController().signal,
    });

    return { fullText: notice + fallbackText, mode: "degraded" };
  } finally {
    clearTimeout(timeout);
  }
}
