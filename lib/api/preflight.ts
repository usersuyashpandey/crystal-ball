import type { z } from "zod";
import { checkRateLimit, getOrCreateSessionId, sessionCookieHeader } from "@/lib/rateLimit";
import type { ErrorResponse } from "@/lib/schemas";

function jsonError(status: number, body: ErrorResponse, extraHeaders?: HeadersInit): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (extraHeaders) new Headers(extraHeaders).forEach((v, k) => headers.set(k, v));
  return new Response(JSON.stringify(body), { status, headers });
}

export interface PreflightOk {
  sessionId: string;
  cookieHeader: string | null;
}

/**
 * Session + rate limit check shared by every assistant route. Returns a
 * ready-to-send Response if the request should be rejected outright (a
 * plain, ordinary HTTP error — this is a request the caller made too many
 * of, not an LLM failure), or the session info to proceed with.
 */
export function preflight(req: Request): PreflightOk | Response {
  const { sessionId, newCookieValue } = getOrCreateSessionId(req);
  const rl = checkRateLimit(sessionId);

  if (!rl.ok) {
    return jsonError(
      429,
      {
        error: "rate_limited",
        message: "Too many requests to the assistant — wait a moment and try again.",
        retryAfterMs: rl.retryAfterMs,
      },
      newCookieValue ? { "Set-Cookie": sessionCookieHeader(newCookieValue) } : undefined,
    );
  }

  return {
    sessionId,
    cookieHeader: newCookieValue ? sessionCookieHeader(newCookieValue) : null,
  };
}

/** Parses and Zod-validates a JSON request body, or returns a 400 Response. */
export async function parseJsonBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | Response> {
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    // Empty body is fine for request shapes where every field is optional.
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return jsonError(400, {
      error: "invalid_request",
      message: result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "),
    });
  }
  return result.data;
}
