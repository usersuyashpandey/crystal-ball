import { preflight, parseJsonBody } from "@/lib/api/preflight";
import { greetingRequestSchema, greetingResponseSchema, type StreamMode } from "@/lib/schemas";
import { getQueueSnapshot } from "@/lib/queue";
import { GREETING_PROMPT_V2 } from "@/prompts/greeting";
import { streamCompletion, INTERRUPTED_NOTICE } from "@/lib/llm";

export const dynamic = "force-dynamic";

/**
 * "Replay Greeting" — short enough that streaming isn't worth the
 * complexity (brief §1 asks for a regenerated greeting, not a
 * conversation), so this is the one JSON, non-streaming assistant
 * endpoint. Still goes through the same timeout/fallback-carrying
 * streamCompletion() as everything else, and pendingCount is computed
 * from the fixture directly rather than trusted from the model.
 */
export async function POST(req: Request) {
  const pre = preflight(req);
  if (pre instanceof Response) return pre;

  const body = await parseJsonBody(req, greetingRequestSchema);
  if (body instanceof Response) return body;
  void body;

  const queue = getQueueSnapshot();
  const fallbackGreeting = `Welcome back — ${queue.length} item${queue.length === 1 ? "" : "s"} pending review.`;

  let greeting = fallbackGreeting;
  let mode: StreamMode = "degraded";

  try {
    const { system, messages } = GREETING_PROMPT_V2.build(queue);
    // Room for reasoning models (e.g. gpt-oss), whose thinking counts toward
    // the limit; the prompt itself keeps the greeting to 1-2 sentences.
    const result = await streamCompletion({ system, messages, maxTokens: 400 });
    // A half-finished greeting reads worse than the template one.
    const interrupted = result.fullText.includes(INTERRUPTED_NOTICE.trim());
    greeting = (!interrupted && result.fullText.trim()) || fallbackGreeting;
    mode = result.mode;
  } catch {
    greeting = fallbackGreeting;
    mode = "degraded";
  }

  const payload = greetingResponseSchema.parse({
    greeting,
    pendingCount: queue.length,
    generatedAt: new Date().toISOString(),
    mode,
  });

  const headers = new Headers({ "Content-Type": "application/json" });
  if (pre.cookieHeader) headers.append("Set-Cookie", pre.cookieHeader);
  return new Response(JSON.stringify(payload), { status: 200, headers });
}
