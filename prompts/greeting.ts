import type { ApprovalItem } from "@/lib/queue";
import type { LLMMessage } from "@/lib/llm/types";
import { ASSISTANT_PERSONA, promptKindTag, queueBlock } from "./context";

/**
 * "Replay Greeting" — the other lighter-depth action. Short enough that it
 * doesn't need the streaming/structured-delimiter machinery the other four
 * prompts use: it's plain text in, plain text out, capped at ~2 sentences,
 * and the route handler derives pendingCount itself rather than trusting
 * the model to count.
 */
export const GREETING_PROMPT_V3 = {
  version: 3,
  // v3: shared persona carries PRIORITY_RULE (safety-critical first), so
  //     every prompt ranks the same way as the summary.
  // v2: current time + server-computed SLA status; light formatting.
  // Earlier versions are in git history.
  kind: "greeting",
  build(queue: ApprovalItem[]): { system: string; messages: LLMMessage[] } {
    const system = `${promptKindTag("greeting")}
${ASSISTANT_PERSONA}

Task: write a short greeting (1-2 sentences, no more) the assistant panel
shows when it opens or when the operator clicks "Replay Greeting". It
should reference how many items are pending right now and, if any item is
safety-critical or clearly overdue, briefly flag that — otherwise keep it
light. Plain text only, no JSON, no markdown.

${queueBlock(queue)}`;

    return { system, messages: [{ role: "user", content: "Generate the greeting." }] };
  },
};
