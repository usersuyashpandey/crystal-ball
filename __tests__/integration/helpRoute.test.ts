/**
 * Integration tests for POST /api/assistant/help (RAG), via Supertest —
 * see summaryRoute.test.ts for how the route is served.
 */
import request from "supertest";
import { serveRoute } from "../helpers/routeServer";
import { parseSse, summarize } from "../helpers/sse";

const ORIGINAL_ENV = { ...process.env };

async function ask(question: string) {
  const { POST } = await import("@/app/api/assistant/help/route");
  return request(serveRoute(POST)).post("/api/assistant/help").send({ question });
}

describe("POST /api/assistant/help", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    jest.resetModules();
  });

  it("grounds an answer in the policy doc for a question it covers", async () => {
    const res = await ask("Who has to approve a safety-critical PDF?");
    expect(res.status).toBe(200);
    const { structured } = summarize(parseSse(res.text));
    expect(structured?.grounded).toBe(true);
    expect((structured?.citations as { heading: string }[]).map((c) => c.heading)).toContain("Approval authority");
  });

  it("reports ungrounded, without inventing an answer, for a question the policy doesn't cover", async () => {
    const res = await ask("What's the best pizza topping?");
    const { structured } = summarize(parseSse(res.text));
    expect(structured?.grounded).toBe(false);
    expect(structured?.citations).toEqual([]);
  });

  it("fallback path: degrades to retrieval-derived citations when the provider fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    jest.doMock("@/lib/llm/providers/anthropic", () => ({
      anthropicProvider: {
        name: "anthropic",
        streamComplete: jest.fn().mockRejectedValue(new Error("simulated outage")),
      },
    }));

    const res = await ask("Who has to approve a safety-critical PDF?");
    expect(res.status).toBe(200);
    const { structured, done } = summarize(parseSse(res.text));
    expect(done?.mode).toBe("degraded");
    // Citations come from our own retrieval, independent of the model, so
    // they stay correct even when the model is unavailable.
    expect(structured?.grounded).toBe(true);
  });

  it("rejects an empty question with 400", async () => {
    const res = await ask("");
    expect(res.status).toBe(400);
  });
});
