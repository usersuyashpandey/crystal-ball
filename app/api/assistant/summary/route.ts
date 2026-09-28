import { preflight, parseJsonBody } from "@/lib/api/preflight";
import { respondStream } from "@/lib/api/respondStream";
import { summaryRequestSchema, summaryStructuredSchema } from "@/lib/schemas";
import { getQueueSnapshot } from "@/lib/queue";
import { computeHeuristicAlerts } from "@/lib/heuristics";
import { checkSummaryAgainstQueue } from "@/lib/structuredChecks";
import { SUMMARY_PROMPT_V3 } from "@/prompts/summary";

export const dynamic = "force-dynamic";

/** "Present me Summary" — streams a prioritized narrative + structured alerts. */
export async function POST(req: Request) {
  const pre = preflight(req);
  if (pre instanceof Response) return pre;

  const body = await parseJsonBody(req, summaryRequestSchema);
  if (body instanceof Response) return body;

  const queue = getQueueSnapshot();
  const { system, messages } = SUMMARY_PROMPT_V3.build(queue, body.language);

  return respondStream({
    system,
    messages,
    structuredSchema: summaryStructuredSchema,
    refine: checkSummaryAgainstQueue(queue),
    fallbackStructured: () => ({
      alerts: computeHeuristicAlerts(queue),
      generatedAt: new Date().toISOString(),
    }),
    cookieHeader: pre.cookieHeader,
  });
}
