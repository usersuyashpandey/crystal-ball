import { checkRateLimit, resetRateLimitStore } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("allows requests under the per-session limit", () => {
    for (let i = 0; i < 30; i += 1) {
      expect(checkRateLimit("session-a").ok).toBe(true);
    }
  });

  it("rejects the request once a session exceeds its window limit", () => {
    for (let i = 0; i < 30; i += 1) checkRateLimit("session-b");
    const result = checkRateLimit("session-b");
    expect(result.ok).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks sessions independently", () => {
    for (let i = 0; i < 30; i += 1) checkRateLimit("session-c");
    expect(checkRateLimit("session-c").ok).toBe(false);
    expect(checkRateLimit("session-d").ok).toBe(true);
  });
});
