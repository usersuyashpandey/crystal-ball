import { preflight, parseJsonBody } from "@/lib/api/preflight";
import { respondStream } from "@/lib/api/respondStream";
import { chatRequestSchema, chatStructuredSchema } from "@/lib/schemas";
import { getQueueSnapshot } from "@/lib/queue";
import { CHAT_PROMPT_V3 } from "@/prompts/chat";
import { checkChatAgainstQueue } from "@/lib/structuredChecks";

export const dynamic = "force-dynamic";

/** "Talk to me" — free-form, multi-turn conversation about the queue. */
export async function POST(req: Request) {
  const pre = preflight(req);
  if (pre instanceof Response) return pre;

  const body = await parseJsonBody(req, chatRequestSchema);
  if (body instanceof Response) return body;

  const queue = getQueueSnapshot();
  const { system, messages } = CHAT_PROMPT_V3.build(queue, body.history, body.message);

  return respondStream({
    system,
    messages,
    structuredSchema: chatStructuredSchema,
    refine: checkChatAgainstQueue(queue),
    fallbackStructured: () => ({ generatedAt: new Date().toISOString(), referencedItemIds: [] }),
    cookieHeader: pre.cookieHeader,
  });
}
