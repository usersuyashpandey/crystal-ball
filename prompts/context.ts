import type { ApprovalItem } from "@/lib/queue";
import type { PolicyChunk } from "@/lib/rag";

/**
 * Shared building blocks for every prompt in /prompts. Keeping these in one
 * place means the offline mock provider (lib/llm/providers/mock.ts) and the
 * real providers are always reading the exact same tags out of the exact
 * same prompt text — there's only one format to keep in sync.
 */

/** Read by the mock provider to pick which canned behavior to run, and
 * useful when debugging a live provider's raw request too. */
export function promptKindTag(kind: string): string {
  return `<promptKind>${kind}</promptKind>`;
}

export function extractPromptKind(system: string): string | null {
  const match = system.match(/<promptKind>(.*?)<\/promptKind>/);
  return match ? match[1] : null;
}

export function queueBlock(queue: ApprovalItem[]): string {
  return `<queue>\n${JSON.stringify(queue, null, 2)}\n</queue>`;
}

// Anchored on the tag being immediately followed by a newline (exactly how
// queueBlock/policyBlock emit it), not just the bare substring "<queue>" —
// the task instructions below legitimately *talk about* "the queue data"
// without meaning to open the data block, and an unanchored regex can
// latch onto that prose instead of the real block. Learned the hard way:
// see the "why anchored, not bare substring" note in __tests__/unit.
export function extractQueue(system: string): ApprovalItem[] | null {
  const match = system.match(/<queue>\n([\s\S]*?)\n<\/queue>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function policyBlock(chunks: PolicyChunk[]): string {
  return `<policy>\n${JSON.stringify(chunks, null, 2)}\n</policy>`;
}

export function extractPolicy(system: string): PolicyChunk[] | null {
  const match = system.match(/<policy>\n([\s\S]*?)\n<\/policy>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export const ASSISTANT_PERSONA = `You are the "Approvals" assistant embedded in OomniEye's digital-twin
Approvals & Review dashboard. You speak to a single operator working
through a queue of pending approvals. Be concise, concrete, and never
invent items, names, or numbers that aren't in the data you're given.
Write plain text: the panel shows your reply as-is, so no markdown
(no **bold**, headings, or bullet syntax).`;
