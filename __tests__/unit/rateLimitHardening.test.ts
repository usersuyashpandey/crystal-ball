import { checkRateLimit, resetRateLimitStore, rateLimitStoreSize, RATE_LIMITS } from "@/lib/rateLimit";

describe("rate limit store hygiene", () => {
  beforeEach(() => resetRateLimitStore());
  afterEach(() => jest.restoreAllMocks());

  it("forgets keys whose whole window has passed, so the store can't grow without bound", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    for (let i = 0; i < 5; i += 1) checkRateLimit(`session-${i}`);
    expect(rateLimitStoreSize()).toBe(5);

    now.mockReturnValue(1_000_000 + RATE_LIMITS.windowMs + 1);
    checkRateLimit("fresh");
    expect(rateLimitStoreSize()).toBe(1);
  });

  it("supports a per-key limit (used for the looser per-IP cap)", () => {
    expect(checkRateLimit("ip:1", 2).ok).toBe(true);
    expect(checkRateLimit("ip:1", 2).ok).toBe(true);
    expect(checkRateLimit("ip:1", 2).ok).toBe(false);
  });
});
