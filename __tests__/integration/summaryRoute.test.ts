/**
 * Integration test for POST /api/assistant/summary.
 *
 * The brief asks for a Supertest test against an AI endpoint. Supertest
 * needs an http.Server to attach to; a Next.js App Router route handler is
 * just an exported `(req: Request) => Response` function with no server of
 * its own to boot in a test (see README's "Testing" section for the fuller
 * version of this note, per the brief's own "say so explicitly" guidance
 * when substituting a listed tool). So this test does the equivalent thing
 * the standard way for this framework: construct a real Fetch API Request,
 * call the exported handler directly, and assert on the real Response —
 * same request/response contract Supertest would exercise, no bespoke
 * mocking of Next internals required.
 *
 * Covers both paths the brief calls out: the success path (offline mock
 * provider, since no API key is set in the test env) and the
 * fallback/timeout path (a configured provider that fails outright).
 */

export {}; // no top-level imports otherwise — force module scope, not global

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

function buildRequest(body: unknown = {}): Request {
  return new Request("http://localhost/api/assistant/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = { ...process.env };

describe("POST /api/assistant/summary", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    // Every test dynamically imports the route handler fresh after this,
    // which re-evaluates lib/rateLimit.ts (and every other module) from
    // scratch — that's what gives each test its own clean in-memory rate
    // limit store, not an explicit reset call.
    jest.resetModules();
  });

  it("success path: streams a narrative and a Zod-valid structured alert per queue item", async () => {
    const { POST } = await import("@/app/api/assistant/summary/route");
    const res = await POST(buildRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const frames = parseSse(await res.text());
    const tokenFrames = frames.filter((f) => f.event === "token");
    const structured = frames.find((f) => f.event === "structured");
    const done = frames.find((f) => f.event === "done");

    expect(tokenFrames.length).toBeGreaterThan(0);
    expect(done?.data.mode).toBe("mock");

    // The structured payload is exactly what the client trusts without
    // re-validating — assert it's actually shaped right, not just present.
    const alerts = structured?.data.alerts as Array<{ itemId: string; urgency: string }>;
    expect(alerts).toBeDefined();
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) {
      expect(["high", "medium", "low"]).toContain(alert.urgency);
    }
  });

  it("rejects a malformed request body with 400 before touching the LLM layer", async () => {
    const { POST } = await import("@/app/api/assistant/summary/route");
    const res = await POST(
      new Request("http://localhost/api/assistant/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: 1 }), // wrong type
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
  });

  it("fallback path: a failing configured provider still returns 200 with a usable structured payload", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    jest.doMock("@/lib/llm/providers/anthropic", () => ({
      anthropicProvider: {
        name: "anthropic",
        streamComplete: jest.fn().mockRejectedValue(new Error("simulated outage")),
      },
    }));

    const { POST } = await import("@/app/api/assistant/summary/route");
    const res = await POST(buildRequest());

    // The brief's own bar: "Killing your API key or forcing a timeout
    // doesn't break the UI" — never a raw 500, never a hung stream.
    expect(res.status).toBe(200);

    const frames = parseSse(await res.text());
    const done = frames.find((f) => f.event === "done");
    const structured = frames.find((f) => f.event === "structured");

    expect(done?.data.mode).toBe("degraded");
    expect(Array.isArray(structured?.data.alerts)).toBe(true);
    expect((structured?.data.alerts as unknown[]).length).toBeGreaterThan(0);
  });
});

// Rate limiting itself (the sliding-window logic) is covered by a fast,
// deterministic unit test against checkRateLimit directly rather than by
// driving 30+ real streamed responses through this route — see
// __tests__/unit/rateLimit.test.ts. Exercising it here would mostly be a
// slow way to re-test lib/rateLimit.ts's own logic.
