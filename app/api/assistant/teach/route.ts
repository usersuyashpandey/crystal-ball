import { preflight, parseJsonBody } from "@/lib/api/preflight";
import { respondStream } from "@/lib/api/respondStream";
import { teachRequestSchema, teachStructuredSchema } from "@/lib/schemas";
import { getQueueSnapshot } from "@/lib/queue";
import { TEACH_PROMPT_V2 } from "@/prompts/teach";

export const dynamic = "force-dynamic";

/** "Teach me" — step-by-step walkthrough for a new operator, adapts to follow-ups. */
export async function POST(req: Request) {
  const pre = preflight(req);
  if (pre instanceof Response) return pre;

  const body = await parseJsonBody(req, teachRequestSchema);
  if (body instanceof Response) return body;

  const queue = getQueueSnapshot();
  const { system, messages } = TEACH_PROMPT_V2.build(queue, body.history, body.message);

  return respondStream({
    system,
    messages,
    structuredSchema: teachStructuredSchema,
    fallbackStructured: () => ({
      generatedAt: new Date().toISOString(),
      isFollowUp: body.history.length > 0,
    }),
    cookieHeader: pre.cookieHeader,
  });
}
