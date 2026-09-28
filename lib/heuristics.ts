import type { ApprovalItem } from "./queue";
import type { SummaryStructured } from "./schemas";

type Urgency = "high" | "medium" | "low";

function urgencyRank(u: Urgency): number {
  return u === "high" ? 2 : u === "medium" ? 1 : 0;
}

/**
 * The non-AI fallback for "Present me Summary", and also what the mock LLM
 * provider's canned narrative is built from. Ranking pending items by SLA
 * overdue-ness and safety flags is genuinely rule-based — no model needed
 * for that part. What the LLM adds on top is the readable narrative,
 * localization, and synthesizing several signals into one sentence a
 * human can act on; see the README's "AI-necessary vs AI-unnecessary"
 * section for the fuller argument.
 */
export function computeHeuristicAlerts(queue: ApprovalItem[]): SummaryStructured["alerts"] {
  const now = Date.now();

  // Policy order (content/approval-policy.md, prompts' PRIORITY_RULE):
  // urgency bucket, then safety-critical, then overdue, then how far along
  // the SLA, then customer-facing. The sort key travels with each alert.
  const ranked = queue.map((item) => {
    const ageHours = (now - new Date(item.submittedAt).getTime()) / 3_600_000;
    const overdueRatio = ageHours / item.slaHours;
    const safetyCritical = item.flags.includes("safety-critical");
    const customerFacing = item.flags.includes("customer-facing");

    let urgency: Urgency = "low";
    if (safetyCritical || overdueRatio >= 1) urgency = "high";
    else if (overdueRatio >= 0.6 || customerFacing) urgency = "medium";

    const reasonParts: string[] = [];
    if (safetyCritical) reasonParts.push("flagged safety-critical");
    if (overdueRatio >= 1) {
      reasonParts.push(`past its ${item.slaHours}h review SLA`);
    } else {
      reasonParts.push(`${Math.round(overdueRatio * 100)}% of the way to its ${item.slaHours}h SLA`);
    }
    if (customerFacing) reasonParts.push("customer-facing");

    const key = [urgencyRank(urgency), safetyCritical ? 1 : 0, overdueRatio >= 1 ? 1 : 0, overdueRatio, customerFacing ? 1 : 0];
    return { alert: { itemId: item.id, title: item.title, urgency, reason: reasonParts.join(", ") }, key };
  });

  ranked.sort((a, b) => {
    for (let i = 0; i < a.key.length; i += 1) {
      if (a.key[i] !== b.key[i]) return b.key[i] - a.key[i];
    }
    return 0;
  });
  return ranked.map((r) => r.alert);
}
