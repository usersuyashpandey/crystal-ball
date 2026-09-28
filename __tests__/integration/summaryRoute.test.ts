/**
 * Integration tests for POST /api/assistant/summary, via Supertest.
 *
 * Next.js App Router handlers have no server of their own, so
 * helpers/routeServer.ts mounts the exported POST on a real Node
 * http.Server and Supertest talks to it over a socket — the same
 * request/response path a browser takes, SSE streaming included.
 *
 * Covers the brief's two required paths: success (offline mock provider,
 * no API key in the test env) and fallback (a configured provider that
 * fails outright), plus request validation.
 */
import request from "supertest";
import { serveRoute } from "../helpers/routeServer";
import { parseSse, summarize } from "../helpers/sse";

const ORIGINAL_ENV = { ...process.env };

async function server() {
  const { POST } = await import("@/app/api/assistant/summary/route");
  return serveRoute(POST);
}

describe("POST /api/assistant/summary", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    // Each test imports the route fresh, so module state (incl. the
    // in-memory rate limiter) doesn't leak between tests.
    jest.resetModules();
  });

  it("success path: streams a narrative, then a valid structured alert per queue item, then done", async () => {
    const res = await request(await server())
      .post("/api/assistant/summary")
      .send({})
      .expect(200)
      .expect("content-type", /text\/event-stream/);

    const frames = parseSse(res.text);
    expect(frames[0].event).toBe("token"); // narrative streams first
    expect(frames.at(-1)?.event).toBe("done"); // and done is always last

    const { narrative, structured, done } = summarize(frames);
    expect(narrative.length).toBeGreaterThan(0);
    expect(narrative).not.toContain("<<<STRUCTURED>>>");
    expect(done).toEqual({ mode: "mock", structuredSource: "model" });

    const alerts = structured!.alerts as Array<{ itemId: string; urgency: string }>;
    expect(alerts).toHaveLength(4);
    for (const alert of alerts) expect(["high", "medium", "low"]).toContain(alert.urgency);
  });

  it("sets a session cookie for rate limiting on first contact", async () => {
    const res = await request(await server()).post("/api/assistant/summary").send({});
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^cb_session=/);
  });

  it("rejects a malformed body with 400 before touching the LLM layer", async () => {
    const res = await request(await server()).post("/api/assistant/summary").send({ language: 1 }).expect(400);
    expect(res.body.error).toBe("invalid_request");
  });

  it("fallback path: a failing provider still returns 200 with a usable payload, marked degraded", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    jest.doMock("@/lib/llm/providers/anthropic", () => ({
      anthropicProvider: {
        name: "anthropic",
        streamComplete: jest.fn().mockRejectedValue(new Error("simulated outage")),
      },
    }));

    // The brief's bar: killing the API key or forcing a timeout must not
    // break the UI — never a raw 500, never a hung stream.
    const res = await request(await server()).post("/api/assistant/summary").send({}).expect(200);
    const { structured, done } = summarize(parseSse(res.text));

    expect(done?.mode).toBe("degraded");
    expect((structured!.alerts as unknown[]).length).toBe(4);
  });
});

// The sliding-window logic itself is unit-tested (unit/rateLimit.test.ts,
// unit/preflight.test.ts) rather than by driving 30+ streamed responses here.
