import type { LLMMessage, LLMProvider, CompletionResult } from "./types";
import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import { geminiProvider } from "./providers/gemini";
import { groqProvider } from "./providers/groq";
import { mockProvider } from "./providers/mock";

export type { LLMMessage, CompletionResult };

/** The brief's 8s: how long we'll wait for the model to start answering. */
export const DEFAULT_TIMEOUT_MS = 8000;
/** How long a stream that has started may go quiet before we give up on it. */
export const DEFAULT_IDLE_TIMEOUT_MS = 8000;

export const INTERRUPTED_NOTICE =
  "\n\n(The live answer was interrupted, so it stops here. Try again for a complete one.)";

const PROVIDERS: Record<string, { provider: LLMProvider; keyEnv: string }> = {
  anthropic: { provider: anthropicProvider, keyEnv: "ANTHROPIC_API_KEY" },
  openai: { provider: openaiProvider, keyEnv: "OPENAI_API_KEY" },
  gemini: { provider: geminiProvider, keyEnv: "GEMINI_API_KEY" },
  groq: { provider: groqProvider, keyEnv: "GROQ_API_KEY" },
};
const AUTO_ORDER = ["anthropic", "openai", "gemini", "groq"];

/**
 * LLM_PROVIDER (anthropic | openai | gemini | groq | mock) forces a provider;
 * otherwise the first one with a key wins, Claude first. A forced provider
 * with no key falls back to the offline mock rather than guessing another.
 */
function selectConfiguredProvider(): LLMProvider | null {
  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "mock") return null;
  if (forced && PROVIDERS[forced]) {
    return process.env[PROVIDERS[forced].keyEnv] ? PROVIDERS[forced].provider : null;
  }
  for (const name of AUTO_ORDER) {
    if (process.env[PROVIDERS[name].keyEnv]) return PROVIDERS[name].provider;
  }
  return null;
}

/** Name, HTTP status and message only: SDK errors don't include the key,
 * and we never log request headers. */
function logProviderFailure(provider: LLMProvider, err: unknown): void {
  if (process.env.NODE_ENV === "test") return;
  const e = err as { status?: number; message?: string; error?: { error?: { message?: string } } };
  const message = e?.error?.error?.message ?? e?.message ?? String(err);
  console.error(`[assistant] ${provider.name} call failed${e?.status ? ` (${e.status})` : ""}: ${message}`);
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
  } catch (err) {
    logProviderFailure(provider, err);
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
