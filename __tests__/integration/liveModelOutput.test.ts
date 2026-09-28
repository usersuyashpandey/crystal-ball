/**
 * Route-level tests of what happens when a *live* model's output reaches
 * the server — the path the offline mock never exercises, because the mock
 * always produces the ideal format. Each case below is a realistic model
 * deviation. The rule being tested: the UI either gets validated model
 * data, or it gets the local fallback AND is told so (structuredSource:
 * "fallback"). Never a silent swap, never invented items.
 */
import { parseSse, summarize, mockAnthropicReply } from "../helpers/sse";
import { APPROVALS_QUEUE } from "@/lib/queue";

const ORIGINAL_ENV = { ...process.env };
const QUEUE_IDS = APPROVALS_QUEUE.map((i) => i.id);

function alertsFor(ids: string[]) {
  return ids.map((id) => ({ itemId: id, title: id, urgency: "medium", reason: "test reason" }));
}

async function callRoute(route: "summary" | "help" | "chat", body: unknown) {
  const { POST } = await import(`@/app/api/assistant/${route}/route`);
  const res: Response = await POST(
    new Request(`http://localhost/api/assistant/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  expect(res.status).toBe(200);
  return summarize(parseSse(await res.text()));
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.OPENAI_API_KEY;
  jest.resetModules();
});

describe("summary route with live-model output", () => {
  it("accepts a well-formed payload covering every queue item and reports it as model data", async () => {
    const payload = { alerts: alertsFor(QUEUE_IDS), generatedAt: "2026-01-01T00:00:00Z" };
    mockAnthropicReply(`All good.\n<<<STRUCTURED>>>\n${JSON.stringify(payload)}`);
    const r = await callRoute("summary", {});
    expect(r.done).toEqual({ mode: "live", structuredSource: "model" });
    expect((r.structured!.alerts as { itemId: string }[]).map((a) => a.itemId)).toEqual(QUEUE_IDS);
  });

  it("uses a ```json-fenced payload instead of discarding it", async () => {
    const payload = { alerts: alertsFor(QUEUE_IDS), generatedAt: "2026-01-01T00:00:00Z" };
    mockAnthropicReply(`Summary.\n<<<STRUCTURED>>>\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
    const r = await callRoute("summary", {});
    expect(r.done?.structuredSource).toBe("model");
  });

  it("never shows raw JSON to the user when the marker has no trailing newline", async () => {
    const payload = { alerts: alertsFor(QUEUE_IDS), generatedAt: "t" };
    mockAnthropicReply(`Drone video first.\n<<<STRUCTURED>>>${JSON.stringify(payload)}`);
    const r = await callRoute("summary", {});
    expect(r.narrative).toBe("Drone video first.");
    expect(r.done?.structuredSource).toBe("model");
  });

  it("rejects an alert for an item that isn't in the queue, and says it fell back", async () => {
    const payload = { alerts: [...alertsFor(QUEUE_IDS.slice(1)), ...alertsFor(["invented-item"])], generatedAt: "t" };
    mockAnthropicReply(`Fine.\n<<<STRUCTURED>>>\n${JSON.stringify(payload)}`);
    const r = await callRoute("summary", {});
    expect(r.done).toEqual({ mode: "live", structuredSource: "fallback" });
    const ids = (r.structured!.alerts as { itemId: string }[]).map((a) => a.itemId);
    expect(ids).not.toContain("invented-item");
    expect(ids.sort()).toEqual([...QUEUE_IDS].sort());
  });

  it("rejects a payload that silently drops a queue item", async () => {
    const payload = { alerts: alertsFor(QUEUE_IDS.slice(0, 2)), generatedAt: "t" };
    mockAnthropicReply(`Fine.\n<<<STRUCTURED>>>\n${JSON.stringify(payload)}`);
    const r = await callRoute("summary", {});
    expect(r.done?.structuredSource).toBe("fallback");
  });

  it("reports a fallback when the model omits the structured part entirely", async () => {
    mockAnthropicReply("Just a narrative, the model forgot the JSON.");
    const r = await callRoute("summary", {});
    expect(r.narrative).toBe("Just a narrative, the model forgot the JSON.");
    expect(r.done).toEqual({ mode: "live", structuredSource: "fallback" });
  });

  it("reports a fallback for wrong-shaped JSON (e.g. urgency outside the enum)", async () => {
    const payload = { alerts: QUEUE_IDS.map((id) => ({ itemId: id, title: id, urgency: "critical", reason: "r" })), generatedAt: "t" };
    mockAnthropicReply(`Fine.\n<<<STRUCTURED>>>\n${JSON.stringify(payload)}`);
    const r = await callRoute("summary", {});
    expect(r.done?.structuredSource).toBe("fallback");
  });
});

describe("help route with live-model output", () => {
  it("drops citations to policy sections that weren't actually retrieved", async () => {
    const payload = {
      citations: [
        { heading: "Approval authority", snippet: "PDFs ... require the Safety Lead" },
        { heading: "Drone Flight Regulations", snippet: "invented section" },
      ],
      grounded: true,
      generatedAt: "t",
    };
    mockAnthropicReply(`Per Approval authority, the Safety Lead.\n<<<STRUCTURED>>>\n${JSON.stringify(payload)}`);
    const r = await callRoute("help", { question: "Who has to approve a safety-critical PDF?" });
    const headings = (r.structured!.citations as { heading: string }[]).map((c) => c.heading);
    expect(headings).toEqual(["Approval authority"]);
  });

  it("marks an answer ungrounded if none of its citations were real", async () => {
    const payload = { citations: [{ heading: "Made Up", snippet: "x" }], grounded: true, generatedAt: "t" };
    mockAnthropicReply(`Answer.\n<<<STRUCTURED>>>\n${JSON.stringify(payload)}`);
    const r = await callRoute("help", { question: "Who has to approve a safety-critical PDF?" });
    expect(r.structured!.grounded).toBe(false);
  });
});

describe("chat route with live-model output", () => {
  it("drops referencedItemIds that don't exist in the queue", async () => {
    const payload = { generatedAt: "t", referencedItemIds: [QUEUE_IDS[0], "ghost-item"] };
    mockAnthropicReply(`Look at the first one.\n<<<STRUCTURED>>>\n${JSON.stringify(payload)}`);
    const r = await callRoute("chat", { message: "which first?", history: [] });
    expect(r.structured!.referencedItemIds).toEqual([QUEUE_IDS[0]]);
  });
});
