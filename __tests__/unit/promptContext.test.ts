import { queueBlock, extractQueue } from "@/prompts/context";
import { SUMMARY_PROMPT_V2 } from "@/prompts/summary";
import type { ApprovalItem } from "@/lib/queue";

/**
 * Found with a live model: the chat said a 48h item "can wait until its SLA
 * expires" when that deadline had already passed. The prompt only carried
 * submission timestamps, and the model can't know the time. The server now
 * states the current time and each item's SLA position, so the model never
 * does date arithmetic.
 */
const NOW = new Date("2026-09-28T20:00:00Z");
const hoursBefore = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function item(id: string, pendingHours: number, slaHours: number): ApprovalItem {
  return {
    id,
    title: id,
    folderPath: "x",
    type: "pdf",
    submittedBy: "Sam",
    submittedAt: hoursBefore(pendingHours),
    slaHours,
    flags: [],
    description: "",
    sizeLabel: "",
  };
}

describe("queueBlock", () => {
  it("states the current time", () => {
    expect(queueBlock([item("a", 1, 24)], NOW)).toContain("2026-09-28T20:00:00.000Z");
  });

  it("gives each item its hours pending and SLA status, computed server-side", () => {
    const block = queueBlock([item("late", 70, 24), item("fine", 12, 48)], NOW);
    const items = extractQueue(block) as Array<ApprovalItem & { hoursPending: number; slaStatus: string }>;
    expect(items.find((i) => i.id === "late")).toMatchObject({ hoursPending: 70, slaStatus: "overdue by 46h" });
    expect(items.find((i) => i.id === "fine")).toMatchObject({ hoursPending: 12, slaStatus: "due in 36h" });
  });

  it("is what every prompt embeds (checked via the summary prompt)", () => {
    // Prompts use the real clock, so build the item relative to it too.
    jest.useFakeTimers().setSystemTime(NOW);
    try {
      const { system } = SUMMARY_PROMPT_V2.build([item("late", 70, 24)], "en");
      expect(system).toContain("overdue by 46h");
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * Found on the deployed app: asked the brief's own example question ("which
 * of these needs my attention first?"), Talk to me put the customer-facing
 * drone video ahead of the overdue safety-critical PDF, contradicting both
 * the policy and Present me Summary. Only the summary prompt carried the
 * priority rule; every prompt that ranks or advises must share it.
 */
describe("shared priority rule", () => {
  it("is in every prompt that can rank or advise on items", async () => {
    const { PRIORITY_RULE } = await import("@/prompts/context");
    const { CHAT_PROMPT_V3 } = await import("@/prompts/chat");
    const { TEACH_PROMPT_V3 } = await import("@/prompts/teach");
    const { GREETING_PROMPT_V3 } = await import("@/prompts/greeting");
    const { SUMMARY_PROMPT_V3 } = await import("@/prompts/summary");
    const queue = [item("late", 70, 24)];
    const systems = [
      CHAT_PROMPT_V3.build(queue, [], "which first?").system,
      TEACH_PROMPT_V3.build(queue, [], undefined).system,
      GREETING_PROMPT_V3.build(queue).system,
      SUMMARY_PROMPT_V3.build(queue, "en").system,
    ];
    for (const system of systems) expect(system).toContain(PRIORITY_RULE);
    expect(PRIORITY_RULE).toMatch(/safety-critical/i);
  });
});
