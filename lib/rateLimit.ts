/**
 * Basic per-session throttling on the AI endpoints (brief §3). This is an
 * in-memory sliding-window log, not `express-rate-limit` — we're on Next.js
 * route handlers, not Express, so there's no middleware chain to hang a
 * package like that off of. It's intentionally simple: one process-wide Map,
 * no Redis, resets on restart. That's explicitly fine for a take-home
 * ("doesn't need to be production-grade, just present and explained") but
 * would need a shared store (Redis, etc.) behind more than one server
 * instance in production.
 */

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_WINDOW = 30;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(sessionId: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const existing = (hits.get(sessionId) ?? []).filter((t) => t > windowStart);

  if (existing.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = existing[0] + WINDOW_MS - now;
    hits.set(sessionId, existing);
    return { ok: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  existing.push(now);
  hits.set(sessionId, existing);
  return { ok: true, remaining: MAX_REQUESTS_PER_WINDOW - existing.length, retryAfterMs: 0 };
}

/** Exposed for tests, which shouldn't see state bleed between cases. */
export function resetRateLimitStore(): void {
  hits.clear();
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

export function sessionCookieHeader(value: string): string {
  return `${SESSION_COOKIE}=${value}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24}`;
}
