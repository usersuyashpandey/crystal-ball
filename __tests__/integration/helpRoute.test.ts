/**
 * Second AI endpoint covered at the integration level — see
 * summaryRoute.test.ts for the fuller explanation of the testing approach
 * (direct route handler invocation in place of Supertest). This one
 * exercises the RAG-grounding path specifically: a question the policy doc
 * covers vs. one it doesn't.
 */

interface SseFrame {
  event: string;
  data: Record<string, unknown>;
}

function parseSse(text: string): SseFrame[] {
  return text
    .split("\n\n")
    .filter((f) => f.trim().length > 0)
    .map((frame) => {
      const eventLine = frame.split("\n").find((l) => l.startsWith("event: ")) ?? "";
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: ")) ?? "";
      return {
        event: eventLine.replace("event: ", "").trim(),
        data: JSON.parse(dataLine.replace("data: ", "")),
      };
    });
}

const ORIGINAL_ENV = { ...process.env };

describe("POST /api/assistant/help", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    jest.resetModules();
  });

  it("grounds an answer in the policy doc for a question it covers", async () => {
    const { POST } = await import("@/app/api/assistant/help/route");
    const req = new Request("http://localhost/api/assistant/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Who has to approve a safety-critical PDF?" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const frames = parseSse(await res.text());
    const structured = frames.find((f) => f.event === "structured");
    expect(structured?.data.grounded).toBe(true);
    expect((structured?.data.citations as unknown[]).length).toBeGreaterThan(0);
  });

  it("reports ungrounded, without inventing an answer, for a question the policy doesn't cover", async () => {
    const { POST } = await import("@/app/api/assistant/help/route");
    const req = new Request("http://localhost/api/assistant/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What's the best pizza topping?" }),
    });

    const res = await POST(req);
    const frames = parseSse(await res.text());
    const structured = frames.find((f) => f.event === "structured");
    expect(structured?.data.grounded).toBe(false);
  });

  it("fallback path: degrades to a valid structured payload when the configured provider fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    jest.doMock("@/lib/llm/providers/anthropic", () => ({
      anthropicProvider: {
        name: "anthropic",
        streamComplete: jest.fn().mockRejectedValue(new Error("simulated outage")),
      },
    }));

    const { POST } = await import("@/app/api/assistant/help/route");
    const req = new Request("http://localhost/api/assistant/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Who has to approve a safety-critical PDF?" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const frames = parseSse(await res.text());
    const done = frames.find((f) => f.event === "done");
    const structured = frames.find((f) => f.event === "structured");
    expect(done?.data.mode).toBe("degraded");
    // The route's own fallbackStructured() derives citations from the
    // retrieval it already did, independent of the model — so even in the
    // degraded path the citations should still be grounded correctly.
    expect(structured?.data.grounded).toBe(true);
  });

  it("rejects an empty question with 400", async () => {
    const { POST } = await import("@/app/api/assistant/help/route");
    const req = new Request("http://localhost/api/assistant/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
