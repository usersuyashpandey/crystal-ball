import type { ApprovalItem } from "./queue";
import type { PolicyChunk } from "./rag";
import type { SummaryStructured, HelpStructured, ChatStructured } from "./schemas";

/**
 * Zod checks that a model's payload has the right *shape*. These check it
 * against the *data the model was given* — the part Zod can't know. Each
 * returns a cleaned payload, or null to reject it (the route then uses its
 * local fallback and reports structuredSource: "fallback").
 */

/** Every queue item exactly once, no invented ids. Partial rankings are
 * rejected rather than patched, since the order is the whole point. */
export function checkSummaryAgainstQueue(queue: ApprovalItem[]) {
  const expected = new Set(queue.map((i) => i.id));
  return (data: SummaryStructured): SummaryStructured | null => {
    const ids = data.alerts.map((a) => a.itemId);
    const unique = new Set(ids);
    if (unique.size !== ids.length) return null;
    if (unique.size !== expected.size) return null;
    for (const id of unique) if (!expected.has(id)) return null;
    return data;
  };
}

/** Keep only citations to sections that were actually retrieved; an answer
 * whose citations were all invented is not grounded, whatever it claims. */
export function checkHelpAgainstRetrieval(chunks: PolicyChunk[]) {
  const retrieved = new Set(chunks.map((c) => c.heading));
  return (data: HelpStructured): HelpStructured => {
    const citations = data.citations.filter((c) => retrieved.has(c.heading));
    return { ...data, citations, grounded: data.grounded && citations.length > 0 };
  };
}

/** Drop references to items that don't exist. */
export function checkChatAgainstQueue(queue: ApprovalItem[]) {
  const ids = new Set(queue.map((i) => i.id));
  return (data: ChatStructured): ChatStructured => ({
    ...data,
    referencedItemIds: data.referencedItemIds.filter((id) => ids.has(id)),
  });
}
