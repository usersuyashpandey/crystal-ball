import type { LLMProvider, StreamCompleteOptions } from "../types";
import { STRUCTURED_DELIMITER } from "../streamSplitter";
import { extractPromptKind, extractQueue, extractPolicy } from "@/prompts/context";
import { computeHeuristicAlerts } from "@/lib/heuristics";
import type { ApprovalItem } from "@/lib/queue";
import type { PolicyChunk } from "@/lib/rag";

/**
 * Deterministic, context-aware offline provider. This is what the app runs
 * on when neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set (documented
 * in the README), and it's also what a live provider falls back to on
 * timeout/failure (lib/llm/index.ts). It reads the same <promptKind>,
 * <queue>, and <policy> tags every real prompt embeds (prompts/context.ts)
 * so its answers are actually grounded in the fixture data, not just
 * placeholder text — and it streams in word-sized chunks so the UI's
 * token-by-token rendering is exercised even with no API key configured.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamWords(text: string, onToken: (delta: string) => void, signal: AbortSignal): Promise<void> {
  const words = text.match(/\S+\s*/g) ?? [text];
  for (const word of words) {
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    onToken(word);
    await sleep(10);
  }
}

function lastUserMessage(messages: StreamCompleteOptions["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function buildSummaryText(queue: ApprovalItem[]): string {
  const alerts = computeHeuristicAlerts(queue);
  const top = alerts[0];
  const highCount = alerts.filter((a) => a.urgency === "high").length;
  const narrative =
    `You have ${queue.length} items pending review. ` +
    `"${top.title}" needs attention first — it's ${top.reason}. ` +
    (highCount > 1
      ? `${highCount} items are high priority right now, so it's worth clearing those before anything else.`
      : `Everything else is in reasonable shape for now.`);

  const structured = { alerts, generatedAt: new Date().toISOString() };
  return `${narrative}${STRUCTURED_DELIMITER}${JSON.stringify(structured)}`;
}

function buildChatText(queue: ApprovalItem[], question: string): string {
  const alerts = computeHeuristicAlerts(queue);
  const top = alerts[0];
  const mentionsWhich = /which|first|priorit|urgent/i.test(question);

  const narrative = mentionsWhich
    ? `"${top.title}" is the one I'd look at first — ${top.reason}. Want me to walk through why, or move on to the next one?`
    : `On "${question.trim().replace(/\?+$/, "")}": based on the current queue, "${top.title}" is the standout item right now (${top.reason}). Let me know if you want detail on a specific item instead.`;

  const structured = {
    generatedAt: new Date().toISOString(),
    referencedItemIds: mentionsWhich ? [top.itemId] : [],
  };
  return `${narrative}${STRUCTURED_DELIMITER}${JSON.stringify(structured)}`;
}

function buildHelpText(question: string, chunks: PolicyChunk[]): string {
  if (chunks.length === 0) {
    const structured = { citations: [], grounded: false, generatedAt: new Date().toISOString() };
    return (
      `The policy doc doesn't cover "${question.trim()}" — nothing in the current approval-policy note ` +
      `speaks to that, so I don't want to guess.${STRUCTURED_DELIMITER}${JSON.stringify(structured)}`
    );
  }

  const lead = chunks[0];
  const firstSentence = lead.body.split(/(?<=[.!?])\s/)[0];
  const narrative = `Per "${lead.heading}": ${firstSentence}`;
  const citations = chunks.map((c) => ({
    heading: c.heading,
    snippet: c.body.split(/(?<=[.!?])\s/).slice(0, 1).join(" "),
  }));
  const structured = { citations, grounded: true, generatedAt: new Date().toISOString() };
  return `${narrative}${STRUCTURED_DELIMITER}${JSON.stringify(structured)}`;
}

function buildTeachText(queue: ApprovalItem[], isFollowUp: boolean, question: string): string {
  const example = queue[0];
  const narrative = isFollowUp
    ? `Good follow-up — on "${question.trim()}": stay consistent with the same review order (open the item, check its type-specific detail, weigh flags and SLA, then decide) rather than treating this as a special case.`
    : `Start with "${example.title}" as an example: open it from the queue, review its type-specific detail (${example.type}), then check whether it's flagged safety-critical or customer-facing — those change who has to sign off. Weigh how close it is to its ${example.slaHours}h SLA, then approve or reject with a one-line reason either way.`;

  const structured = { generatedAt: new Date().toISOString(), isFollowUp };
  return `${narrative}${STRUCTURED_DELIMITER}${JSON.stringify(structured)}`;
}

function buildGreetingText(queue: ApprovalItem[]): string {
  const alerts = computeHeuristicAlerts(queue);
  const highCount = alerts.filter((a) => a.urgency === "high").length;
  if (highCount > 0) {
    return `Welcome back — ${queue.length} items are pending, and ${highCount} of them need your attention first.`;
  }
  return `Welcome back — ${queue.length} items are pending review, nothing urgent flagged right now.`;
}

export const mockProvider: LLMProvider = {
  name: "mock",
  async streamComplete({ system, messages, onToken, signal }: StreamCompleteOptions) {
    const kind = extractPromptKind(system) ?? "unknown";
    const queue = extractQueue(system) ?? [];
    const policy = extractPolicy(system) ?? [];
    const question = lastUserMessage(messages);

    let fullText: string;
    switch (kind) {
      case "summary":
        fullText = buildSummaryText(queue);
        break;
      case "chat":
        fullText = buildChatText(queue, question);
        break;
      case "help":
        fullText = buildHelpText(question, policy);
        break;
      case "teach":
        fullText = buildTeachText(queue, messages.filter((m) => m.role === "assistant").length > 0, question);
        break;
      case "greeting":
        fullText = buildGreetingText(queue);
        break;
      default:
        fullText = "I don't have a canned offline response for this action yet.";
    }

    await streamWords(fullText, onToken, signal);
    return { fullText };
  },
};
