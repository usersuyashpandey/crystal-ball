import { preflight, parseJsonBody } from "@/lib/api/preflight";
import { respondStream } from "@/lib/api/respondStream";
import { helpRequestSchema, helpStructuredSchema } from "@/lib/schemas";
import { retrieveChunks } from "@/lib/rag";
import { HELP_PROMPT_V1 } from "@/prompts/help";
import { checkHelpAgainstRetrieval } from "@/lib/structuredChecks";

export const dynamic = "force-dynamic";

/** "Help me" — RAG-grounded answer to an operational question. */
export async function POST(req: Request) {
  const pre = preflight(req);
  if (pre instanceof Response) return pre;

  const body = await parseJsonBody(req, helpRequestSchema);
  if (body instanceof Response) return body;

  const chunks = retrieveChunks(body.question);
  const { system, messages } = HELP_PROMPT_V1.build(body.question, chunks);

  return respondStream({
    system,
    messages,
    structuredSchema: helpStructuredSchema,
    refine: checkHelpAgainstRetrieval(chunks),
    fallbackStructured: () => ({
      citations: chunks.map((c) => ({ heading: c.heading, snippet: c.body.slice(0, 160) })),
      grounded: chunks.length > 0,
      generatedAt: new Date().toISOString(),
    }),
    cookieHeader: pre.cookieHeader,
  });
}
