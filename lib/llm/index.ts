import type { LLMMessage, LLMProvider, CompletionResult } from "./types";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { mockProvider } from "./providers/mock";

export type { LLMMessage, CompletionResult };

/** The brief's 8s: how long we'll wait for the model to start answering. */
export const DEFAULT_TIMEOUT_MS = 8000;
/** How long a stream that has started may go quiet before we give up on it. */
export const DEFAULT_IDLE_TIMEOUT_MS = 8000;

export const INTERRUPTED_NOTICE =
  "\n\n(The live answer was interrupted, so it stops here. Try again for a complete one.)";

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
  /** Max wait for the first token. */
  timeoutMs?: number;
  /** Max gap between tokens once streaming has started. */
  idleTimeoutMs?: number;
}

/**
 * The single entry point every route handler calls; the brief's "Fallback
 * design" (§3) lives here.
 *
 * - No first token within `timeoutMs` (8s), or an error before any output:
 *   answer from the offline mock provider instead (fast, grounded in the
 *   same fixture data), mode "degraded".
 * - Stream starts, then stalls for `idleTimeoutMs` or errors: stop there
 *   and append a short notice, mode "degraded". We don't append a second,
 *   unrelated mock answer to a half-finished live one.
 * - Never throws. The race against our own abort also means a provider
 *   that ignores the AbortSignal can't hang the request.
 */
export async function streamCompletion({
  system,
  messages,
  maxTokens,
  onToken = () => {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
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
  let timer = setTimeout(() => controller.abort(new Error("llm_first_token_timeout")), timeoutMs);
  const abortedPromise = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(controller.signal.reason));
  });
  // Nothing may be waiting on it if the provider wins the race.
  abortedPromise.catch(() => {});

  let streamed = "";

  try {
    const { fullText } = await Promise.race([
      provider.streamComplete({
        system,
        messages,
        maxTokens,
        signal: controller.signal,
        onToken: (delta) => {
          if (controller.signal.aborted) return; // late tokens after a timeout
          clearTimeout(timer);
          timer = setTimeout(() => controller.abort(new Error("llm_idle_timeout")), idleTimeoutMs);
          streamed += delta;
          onToken(delta);
        },
      }),
      abortedPromise,
    ]);
    return { fullText, mode: "live" };
  } catch {
    if (!controller.signal.aborted) controller.abort(new Error("llm_error"));

    if (streamed) {
      onToken(INTERRUPTED_NOTICE);
      return { fullText: streamed + INTERRUPTED_NOTICE, mode: "degraded" };
    }

    const { fullText } = await mockProvider.streamComplete({
      system,
      messages,
      maxTokens,
      onToken,
      signal: new AbortController().signal,
    });
    return { fullText, mode: "degraded" };
  } finally {
    clearTimeout(timer);
  }
}
