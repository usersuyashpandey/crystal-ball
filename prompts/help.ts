import type { PolicyChunk } from "@/lib/rag";
import type { LLMMessage } from "@/lib/llm/types";
import { STRUCTURED_DELIMITER } from "@/lib/llm/streamSplitter";
import { ASSISTANT_PERSONA, promptKindTag, policyBlock } from "./context";

/**
 * "Help me" — answers a specific operational question, grounded in the
 * retrieved policy chunks (lib/rag.ts), not the model's general knowledge.
 * If retrieval came back empty, we still call this prompt so the model can
 * say "the policy doc doesn't cover that" instead of the route handler
 * silently guessing — but note it's `grounded: false` in that case.
 */
export const HELP_PROMPT_V1 = {
  version: 1,
  kind: "help",
  build(question: string, chunks: PolicyChunk[]): { system: string; messages: LLMMessage[] } {
    const system = `${promptKindTag("help")}
${ASSISTANT_PERSONA}

Task: answer the operator's operational question using ONLY the policy
excerpts in <policy> below. Do not use general knowledge about approval
processes, drones, or anything else — if the excerpts don't cover the
question, say plainly that the policy doc doesn't address it rather than
inventing an answer.

Output format (exactly two parts, in this order, nothing else):
1. A direct answer, a few sentences at most, citing which policy section(s)
   it came from by name (e.g. "Per Safety-critical submissions, ...").
2. The exact line "${STRUCTURED_DELIMITER.trim()}" on its own, followed by
   one JSON object (no markdown fences, no trailing text) of the shape:
   {"citations": [{"heading": string, "snippet": string}], "grounded": boolean, "generatedAt": ISO-8601 string}
   "grounded" is false only if <policy> has no chunks or none were
   actually relevant to the question.

${policyBlock(chunks)}`;

    return { system, messages: [{ role: "user", content: question }] };
  },
};
