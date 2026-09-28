import type { z } from "zod";
import type { LLMMessage } from "@/lib/llm/types";
import { streamCompletion } from "@/lib/llm";
import { StructuredStreamSplitter } from "@/lib/llm/streamSplitter";
import { extractJsonObject } from "@/lib/llm/extractJson";
import { sseFrame, SSE_HEADERS } from "@/lib/sse";
import type { StreamMode, StructuredSource } from "@/lib/schemas";

export interface RespondStreamArgs<TStructured> {
  system: string;
  messages: LLMMessage[];
  structuredSchema: z.ZodType<TStructured>;
  /** Semantic check against the data the model was given (see
   * lib/structuredChecks.ts). Return a cleaned payload, or null to reject. */
  refine?: (data: TStructured) => TStructured | null;
  /** Used if the model's structured tail is missing, unparseable, fails Zod,
   * or is rejected by `refine`. The client is always told when this
   * happened (structuredSource: "fallback"), so it's never a silent swap. */
  fallbackStructured: () => TStructured;
  cookieHeader?: string | null;
  maxTokens?: number;
}

export function validateStructured<T>(
  structuredRaw: string | null,
  schema: z.ZodType<T>,
  refine?: (data: T) => T | null,
): T | null {
  if (!structuredRaw) return null;
  const parsed = extractJsonObject(structuredRaw);
  if (parsed === null) return null;
  const result = schema.safeParse(parsed);
  if (!result.success) return null;
  return refine ? refine(result.data) : result.data;
}

/**
 * Shared SSE plumbing for the four streaming assistant actions (summary,
 * chat, help, teach). Frames, in order: any number of `token` events
 * (narrative only — the structured tail is never forwarded as tokens), one
 * `structured` event (always a schema-valid payload), and one `done` event
 * carrying { mode, structuredSource }. The HTTP status is always 200: a
 * failed or timed-out LLM call degrades inside the stream (lib/llm/index.ts)
 * rather than surfacing as an error status mid-stream.
 */
export function respondStream<TStructured>({
  system,
  messages,
  structuredSchema,
  refine,
  fallbackStructured,
  cookieHeader,
  maxTokens,
}: RespondStreamArgs<TStructured>): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseFrame(event, data)));
      };
      const finish = (structured: TStructured, mode: StreamMode, structuredSource: StructuredSource) => {
        send("structured", structured);
        send("done", { mode, structuredSource });
      };

      const splitter = new StructuredStreamSplitter((text) => send("token", { text }));

      try {
        const { mode } = await streamCompletion({
          system,
          messages,
          maxTokens,
          onToken: (delta) => splitter.push(delta),
        });

        const { structuredRaw } = splitter.finalize();
        const validated = validateStructured(structuredRaw, structuredSchema, refine);

        if (validated) {
          finish(validated, mode, "model");
        } else {
          if (mode === "live" && process.env.NODE_ENV !== "test") {
            console.warn("[assistant] live model returned an unusable structured payload; using fallback");
          }
          finish(fallbackStructured(), mode, "fallback");
        }
      } catch {
        // streamCompletion() degrades internally and shouldn't throw, but if
        // anything around it does, still end the stream with a usable payload.
        send("token", { text: "\n\nSomething went wrong generating this, so this is a basic view instead." });
        finish(fallbackStructured(), "degraded", "fallback");
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers(SSE_HEADERS);
  if (cookieHeader) headers.append("Set-Cookie", cookieHeader);

  return new Response(stream, { status: 200, headers });
}
