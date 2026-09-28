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

export function extractQueue(system: string): ApprovalItem[] | null {
  const match = system.match(/<queue>([\s\S]*?)<\/queue>/);
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
  const match = system.match(/<policy>([\s\S]*?)<\/policy>/);
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
invent items, names, or numbers that aren't in the data you're given.`;
