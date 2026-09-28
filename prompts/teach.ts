import type { ApprovalItem } from "@/lib/queue";
import type { LLMMessage } from "@/lib/llm/types";
import { STRUCTURED_DELIMITER } from "@/lib/llm/streamSplitter";
import { ASSISTANT_PERSONA, promptKindTag, queueBlock } from "./context";

/**
 * "Teach me" — walks a new operator through how to review and act on an
 * approval, adapting if they ask a follow-up. Scoped as one of the two
 * lighter-depth actions for this submission (see README) — it reuses the
 * same delimiter/structured pattern as the other streaming actions rather
 * than a bespoke format, so it isn't skipped, just simpler.
 */
export const TEACH_PROMPT_V3 = {
  version: 3,
  // v3: shared persona carries PRIORITY_RULE (safety-critical first), so
  //     every prompt ranks the same way as the summary.
  // v2: current time + server-computed SLA status; light formatting.
  // Earlier versions are in git history.
  kind: "teach",
  build(
    queue: ApprovalItem[],
    history: LLMMessage[],
    message: string | undefined,
  ): { system: string; messages: LLMMessage[] } {
    const system = `${promptKindTag("teach")}
${ASSISTANT_PERSONA}

Task: teach a brand-new operator how to review and act on an approval in
this queue, step by step (open the item, check its type-specific detail,
weigh urgency/flags, approve or reject with a reason). Use a real item
from the queue data below as your example so it's concrete, not abstract. If this is a
follow-up question (history is non-empty), answer it directly and relate
it back to the walkthrough rather than restarting from step one.

Output format (exactly two parts, in this order, nothing else):
1. The walkthrough or follow-up answer.
2. The exact line "${STRUCTURED_DELIMITER.trim()}" on its own, followed by
   one JSON object (no markdown fences, no trailing text) of the shape:
   {"generatedAt": ISO-8601 string, "isFollowUp": boolean}

${queueBlock(queue)}`;

    const userMessage = message ?? "Walk me through how to review and act on an approval.";
    return { system, messages: [...history, { role: "user", content: userMessage }] };
  },
};
