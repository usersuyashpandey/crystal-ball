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

  return queue
    .map((item) => {
      const ageHours = (now - new Date(item.submittedAt).getTime()) / 3_600_000;
      const overdueRatio = ageHours / item.slaHours;
      const safetyCritical = item.flags.includes("safety-critical");

      let urgency: Urgency = "low";
      if (safetyCritical || overdueRatio >= 1) urgency = "high";
      else if (overdueRatio >= 0.6 || item.flags.includes("customer-facing")) urgency = "medium";

      const reasonParts: string[] = [];
      if (safetyCritical) reasonParts.push("flagged safety-critical");
      if (overdueRatio >= 1) {
        reasonParts.push(`past its ${item.slaHours}h review SLA`);
      } else {
        reasonParts.push(`${Math.round(overdueRatio * 100)}% of the way to its ${item.slaHours}h SLA`);
      }
      if (item.flags.includes("customer-facing")) reasonParts.push("customer-facing");

      return {
        itemId: item.id,
        title: item.title,
        urgency,
        reason: reasonParts.join(", "),
      };
    })
    .sort((a, b) => urgencyRank(b.urgency) - urgencyRank(a.urgency));
}
