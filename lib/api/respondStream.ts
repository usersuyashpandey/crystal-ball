import type { z } from "zod";
import type { LLMMessage } from "@/lib/llm/types";
import { streamCompletion } from "@/lib/llm";
import { StructuredStreamSplitter } from "@/lib/llm/streamSplitter";
import { extractJsonObject } from "@/lib/llm/extractJson";
import { sseFrame, SSE_HEADERS } from "@/lib/sse";

export interface RespondStreamArgs<TStructured> {
  system: string;
  messages: LLMMessage[];
  structuredSchema: z.ZodType<TStructured>;
  /** Used verbatim if the model's structured tail is missing or fails
   * validation — this is what "the UI never trusts raw model text
   * directly" (brief §6) means in practice: even the structured half goes
   * through Zod before it reaches the client, and there's always a safe
   * value on the other side of a validation failure. */
  fallbackStructured: () => TStructured;
  cookieHeader?: string | null;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Shared SSE plumbing for the four streaming assistant actions (summary,
 * chat, help, teach). Frames emitted, in order: any number of `token`
 * events (narrative text only — the structured tail is never forwarded as
 * tokens), one `structured` event (Zod-validated), one `done` event
 * carrying which mode served the request. The HTTP response is always 200
 * text/event-stream: a failed or timed-out LLM call degrades *inside* the
 * stream (see lib/llm/index.ts) rather than changing the response status,
 * so the UI never has to handle a mid-stream HTTP error.
 */
export function respondStream<TStructured>({
  system,
  messages,
  structuredSchema,
  fallbackStructured,
  cookieHeader,
  maxTokens,
  timeoutMs,
}: RespondStreamArgs<TStructured>): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseFrame(event, data)));
      };

      const splitter = new StructuredStreamSplitter((text) => send("token", { text }));

      try {
        const { mode } = await streamCompletion({
          system,
          messages,
          maxTokens,
          timeoutMs,
          onToken: (delta) => splitter.push(delta),
        });

        const { structuredRaw } = splitter.finalize();
        const parsedRaw = structuredRaw ? extractJsonObject(structuredRaw) : null;
        const validated = parsedRaw ? structuredSchema.safeParse(parsedRaw) : null;
        const structured = validated?.success ? validated.data : fallbackStructured();

        send("structured", structured);
        send("done", { mode });
      } catch {
        // Belt-and-suspenders: streamCompletion() already degrades to the
        // mock provider internally and shouldn't throw, but if anything
        // upstream of it does, the stream still ends cleanly with a usable
        // structured payload instead of hanging open or dying silently.
        send("token", { text: "\n\n_Something went wrong generating this — showing a basic view instead._\n\n" });
        send("structured", fallbackStructured());
        send("done", { mode: "degraded" });
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers(SSE_HEADERS);
  if (cookieHeader) headers.append("Set-Cookie", cookieHeader);

  return new Response(stream, { status: 200, headers });
}
