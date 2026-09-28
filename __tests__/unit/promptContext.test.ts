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
