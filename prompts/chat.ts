import type { ApprovalItem } from "@/lib/queue";
import type { LLMMessage } from "@/lib/llm/types";
import { STRUCTURED_DELIMITER } from "@/lib/llm/streamSplitter";
import { ASSISTANT_PERSONA, promptKindTag, queueBlock } from "./context";

/** "Talk to me" — free-form, multi-turn conversation about the queue. */
export const CHAT_PROMPT_V1 = {
  version: 1,
  kind: "chat",
  build(
    queue: ApprovalItem[],
    history: LLMMessage[],
    message: string,
  ): { system: string; messages: LLMMessage[] } {
    const system = `${promptKindTag("chat")}
${ASSISTANT_PERSONA}

Task: hold a free-form conversation with the operator about the
approvals queue below (e.g. "which of these needs my attention first and
why?", "tell me more about the drone video"). Answer only from the queue
data below — if asked something the data can't answer, say so plainly
rather than guessing.

Output format (exactly two parts, in this order, nothing else):
1. Your conversational reply, a few sentences at most.
2. The exact line "${STRUCTURED_DELIMITER.trim()}" on its own, followed by
   one JSON object (no markdown fences, no trailing text) of the shape:
   {"generatedAt": ISO-8601 string, "referencedItemIds": string[]}
   ("referencedItemIds" lists the item ids your reply actually talked
   about; empty array if none.)

${queueBlock(queue)}`;

    return { system, messages: [...history, { role: "user", content: message }] };
  },
};
