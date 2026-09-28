import type { ApprovalItem } from "@/lib/queue";
import type { LLMMessage } from "@/lib/llm/types";
import { STRUCTURED_DELIMITER } from "@/lib/llm/streamSplitter";
import { ASSISTANT_PERSONA, promptKindTag, queueBlock } from "./context";

/**
 * "Present me Summary" — versioned prompt export per the brief (§3, "prompts
 * live in /prompts/*.ts as versioned exports, not inline strings inside
 * route handlers"). Bump to SUMMARY_PROMPT_V3 rather than editing this one
 * in place if the shape or instructions change meaningfully.
 */
export const SUMMARY_PROMPT_V2 = {
  version: 2,
  // v2: shared context now states the current time and each item's
  // server-computed SLA status; light-formatting rule in the persona.
  // v1 is in git history (before eb4ddff).
  kind: "summary",
  build(queue: ApprovalItem[], language: string): { system: string; messages: LLMMessage[] } {
    const system = `${promptKindTag("summary")}
${ASSISTANT_PERSONA}

Task: summarise the current queue of pending approvals for the operator,
prioritised by genuine urgency — combine each item's flags (a
"safety-critical" flag always makes it top priority), how far past its
SLA target it is, and whether it's customer-facing. Do not just repeat
the SLA hours; explain what they mean for the operator right now.

Output format (exactly two parts, in this order, nothing else):
1. A short spoken-style narrative, 2-4 sentences, in ${language}, that a
   busy operator could skim or have read aloud. Lead with the single most
   urgent item and why.
2. The exact line "${STRUCTURED_DELIMITER.trim()}" on its own, followed by
   one JSON object (no markdown fences, no trailing text) of the shape:
   {"alerts": [{"itemId": string, "title": string, "urgency": "high"|"medium"|"low", "reason": string (<=240 chars)}], "generatedAt": ISO-8601 string}
   Every item in the queue data below must appear exactly once in "alerts".

${queueBlock(queue)}`;

    return {
      system,
      messages: [{ role: "user", content: "Summarise the current approvals queue for me." }],
    };
  },
};
