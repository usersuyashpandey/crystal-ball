/**
 * Basic throttling on the AI endpoints (brief §3). An in-memory
 * sliding-window log rather than `express-rate-limit`, since these are
 * Next.js route handlers with no Express middleware chain.
 *
 * Two keys per request (see lib/api/preflight.ts):
 * - per session (cookie): 30 requests / 5 min — the brief's "per-session".
 * - per IP: 120 / 5 min — looser, but it stops a client that simply drops
 *   its cookie from getting a fresh allowance on every request.
 *
 * Deliberately not production-grade: one process-local Map that resets on
 * restart. Behind more than one instance this needs a shared store
 * (Redis or similar), and the IP key assumes a trusted proxy sets
 * x-forwarded-for.
 */

export const RATE_LIMITS = {
  windowMs: 5 * 60 * 1000,
  perSession: 30,
  perIp: 120,
} as const;

const hits = new Map<string, number[]>();
let lastSweep = 0;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** Drop keys with no hits inside the current window. Runs at most once per
 * window, so the cost stays small however many keys exist. */
function sweep(now: number): void {
  if (now - lastSweep < RATE_LIMITS.windowMs) return;
  lastSweep = now;
  const windowStart = now - RATE_LIMITS.windowMs;
  for (const [key, timestamps] of hits) {
    if (timestamps[timestamps.length - 1] <= windowStart) hits.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number = RATE_LIMITS.perSession): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const windowStart = now - RATE_LIMITS.windowMs;

  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, remaining: 0, retryAfterMs: Math.max(recent[0] + RATE_LIMITS.windowMs - now, 0) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { ok: true, remaining: limit - recent.length, retryAfterMs: 0 };
}

/** Test helpers: the store is module state. */
export function resetRateLimitStore(): void {
  hits.clear();
  lastSweep = 0;
}
export function rateLimitStoreSize(): number {
  return hits.size;
}

const SESSION_COOKIE = "cb_session";

export function getOrCreateSessionId(req: Request): { sessionId: string; newCookieValue: string | null } {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (match) {
    return { sessionId: match[1], newCookieValue: null };
  }
  const sessionId = crypto.randomUUID();
  return { sessionId, newCookieValue: sessionId };
}

/** First x-forwarded-for entry is the client; later ones are proxies. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function sessionCookieHeader(value: string): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}`;
}
