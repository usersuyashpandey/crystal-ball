import { computeHeuristicAlerts } from "@/lib/heuristics";
import type { ApprovalItem } from "@/lib/queue";

function item(overrides: Partial<ApprovalItem>): ApprovalItem {
  return {
    id: "item-1",
    title: "Test item",
    folderPath: "Test",
    type: "pdf",
    submittedBy: "Someone",
    submittedAt: new Date().toISOString(),
    slaHours: 24,
    flags: [],
    description: "",
    sizeLabel: "1 file",
    ...overrides,
  };
}

describe("computeHeuristicAlerts", () => {
  it("always ranks a safety-critical item as high urgency, even if it's brand new", () => {
    const queue = [item({ id: "a", flags: ["safety-critical"], submittedAt: new Date().toISOString() })];
    const [alert] = computeHeuristicAlerts(queue);
    expect(alert.urgency).toBe("high");
    expect(alert.reason).toMatch(/safety-critical/);
  });

  it("ranks an item past its SLA as high urgency", () => {
    const queue = [
      item({
        id: "b",
        slaHours: 24,
        submittedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30h ago
      }),
    ];
    const [alert] = computeHeuristicAlerts(queue);
    expect(alert.urgency).toBe("high");
  });

  it("sorts high-urgency items ahead of low-urgency ones", () => {
    const queue = [
      item({ id: "low", submittedAt: new Date().toISOString(), slaHours: 72 }),
      item({ id: "high", flags: ["safety-critical"], submittedAt: new Date().toISOString() }),
    ];
    const alerts = computeHeuristicAlerts(queue);
    expect(alerts[0].itemId).toBe("high");
    expect(alerts[1].itemId).toBe("low");
  });

  it("produces exactly one alert per queue item", () => {
    const queue = [item({ id: "x" }), item({ id: "y" }), item({ id: "z" })];
    expect(computeHeuristicAlerts(queue)).toHaveLength(3);
  });

  it("within the same urgency, an overdue safety-critical item outranks an overdue customer-facing one (policy order)", () => {
    const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    const queue = [
      item({ id: "drone", flags: ["customer-facing"], slaHours: 48, submittedAt: ago(51) }),
      item({ id: "safety", flags: ["safety-critical"], slaHours: 24, submittedAt: ago(70) }),
    ];
    expect(computeHeuristicAlerts(queue).map((a) => a.itemId)).toEqual(["safety", "drone"]);
  });

  it("then ranks more-overdue items first among equals", () => {
    const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    const queue = [
      item({ id: "a-bit-late", slaHours: 24, submittedAt: ago(26) }),
      item({ id: "very-late", slaHours: 24, submittedAt: ago(60) }),
    ];
    expect(computeHeuristicAlerts(queue).map((a) => a.itemId)).toEqual(["very-late", "a-bit-late"]);
  });
});
