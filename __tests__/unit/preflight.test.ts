import { preflight, parseJsonBody } from "@/lib/api/preflight";
import { resetRateLimitStore } from "@/lib/rateLimit";
import { z } from "zod";

describe("preflight", () => {
  beforeEach(() => resetRateLimitStore());

  it("returns session info and a Set-Cookie header for a first-time visitor", () => {
    const req = new Request("http://localhost/api/assistant/summary", { method: "POST" });
    const result = preflight(req);
    expect(result).not.toBeInstanceOf(Response);
    if (result instanceof Response) throw new Error("unreachable");
    expect(result.sessionId).toBeTruthy();
    expect(result.cookieHeader).toContain("cb_session=");
  });

  it("reuses the session id from an existing cookie without issuing a new one", () => {
    const req = new Request("http://localhost/api/assistant/summary", {
      method: "POST",
      headers: { Cookie: "cb_session=existing-session-id" },
    });
    const result = preflight(req);
    if (result instanceof Response) throw new Error("unreachable");
    expect(result.sessionId).toBe("existing-session-id");
    expect(result.cookieHeader).toBeNull();
  });

  it("responds 429 once a session exceeds the per-window request limit — this is the real integration point between lib/rateLimit and the HTTP layer", () => {
    const cookie = "cb_session=rate-limited-session";
    let lastResult: ReturnType<typeof preflight> | undefined;

    for (let i = 0; i < 31; i += 1) {
      lastResult = preflight(
        new Request("http://localhost/api/assistant/summary", { method: "POST", headers: { Cookie: cookie } }),
      );
    }

    expect(lastResult).toBeInstanceOf(Response);
    const res = lastResult as Response;
    expect(res.status).toBe(429);
  });
});

describe("preflight — clients that drop their session cookie", () => {
  beforeEach(() => resetRateLimitStore());

  const fromIp = (ip: string) =>
    new Request("http://localhost/api/assistant/summary", { method: "POST", headers: { "x-forwarded-for": ip } });

  it("still caps a client that sends no cookie (a fresh session every request) via a per-IP limit", () => {
    let last: ReturnType<typeof preflight> | undefined;
    for (let i = 0; i < 121; i += 1) last = preflight(fromIp("203.0.113.7"));
    expect(last).toBeInstanceOf(Response);
    expect((last as Response).status).toBe(429);
  });

  it("keeps IPs independent", () => {
    for (let i = 0; i < 121; i += 1) preflight(fromIp("203.0.113.7"));
    expect(preflight(fromIp("198.51.100.2"))).not.toBeInstanceOf(Response);
  });

  it("uses the first address in x-forwarded-for (the client, not the proxy)", () => {
    for (let i = 0; i < 121; i += 1) preflight(fromIp("203.0.113.7, 10.0.0.1"));
    expect(preflight(fromIp("203.0.113.7"))).toBeInstanceOf(Response);
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ question: z.string().min(1) });

  it("returns the parsed body when it matches the schema", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      body: JSON.stringify({ question: "hi" }),
    });
    const result = await parseJsonBody(req, schema);
    expect(result).toEqual({ question: "hi" });
  });

  it("returns a 400 Response with a readable message when validation fails", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: JSON.stringify({}) });
    const result = await parseJsonBody(req, schema);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
  });

  it("treats an unparseable body as an empty object rather than throwing", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "not json" });
    const result = await parseJsonBody(req, schema);
    expect(result).toBeInstanceOf(Response);
  });
});
