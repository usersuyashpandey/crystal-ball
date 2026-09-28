import { z } from "zod";

/**
 * Request/response contracts for every assistant endpoint, defined with Zod
 * before the route handlers (see /openapi.yaml for the human-readable
 * mirror of this file — OpenAPI-first spirit per the brief, §3). Route
 * handlers parse every request through these schemas and validate every
 * LLM-derived structured payload through them too, so the UI never trusts
 * raw model text directly.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Every SSE stream opens with one of these so the client knows up front
 * whether it's watching a live model, the offline mock, or a degraded
 * fallback — never silently ambiguous. */
export const streamModeSchema = z.enum(["live", "mock", "degraded"]);
export type StreamMode = z.infer<typeof streamModeSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  retryAfterMs: z.number().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ---------------------------------------------------------------------------
// Present me Summary
// ---------------------------------------------------------------------------

export const summaryRequestSchema = z.object({
  language: z.string().min(2).max(32).optional().default("en"),
});
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

export const summaryAlertSchema = z.object({
  itemId: z.string(),
  title: z.string(),
  urgency: z.enum(["high", "medium", "low"]),
  reason: z.string().max(240),
});

export const summaryStructuredSchema = z.object({
  alerts: z.array(summaryAlertSchema).min(1),
  generatedAt: z.string(),
});
export type SummaryStructured = z.infer<typeof summaryStructuredSchema>;

// ---------------------------------------------------------------------------
// Talk to me
// ---------------------------------------------------------------------------

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(chatMessageSchema).max(20).default([]),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatStructuredSchema = z.object({
  generatedAt: z.string(),
  referencedItemIds: z.array(z.string()).default([]),
});
export type ChatStructured = z.infer<typeof chatStructuredSchema>;

// ---------------------------------------------------------------------------
// Help me (RAG)
// ---------------------------------------------------------------------------

export const helpRequestSchema = z.object({
  question: z.string().min(1).max(1000),
});
export type HelpRequest = z.infer<typeof helpRequestSchema>;

export const helpCitationSchema = z.object({
  heading: z.string(),
  snippet: z.string(),
});

export const helpStructuredSchema = z.object({
  citations: z.array(helpCitationSchema),
  grounded: z.boolean(),
  generatedAt: z.string(),
});
export type HelpStructured = z.infer<typeof helpStructuredSchema>;

// ---------------------------------------------------------------------------
// Teach me
// ---------------------------------------------------------------------------

export const teachRequestSchema = z.object({
  message: z.string().min(1).max(2000).optional(),
  history: z.array(chatMessageSchema).max(20).default([]),
});
export type TeachRequest = z.infer<typeof teachRequestSchema>;

export const teachStructuredSchema = z.object({
  generatedAt: z.string(),
  isFollowUp: z.boolean(),
});
export type TeachStructured = z.infer<typeof teachStructuredSchema>;

// ---------------------------------------------------------------------------
// Replay Greeting
// ---------------------------------------------------------------------------

export const greetingRequestSchema = z.object({});
export type GreetingRequest = z.infer<typeof greetingRequestSchema>;

export const greetingResponseSchema = z.object({
  greeting: z.string(),
  pendingCount: z.number(),
  generatedAt: z.string(),
  mode: streamModeSchema,
});
export type GreetingResponse = z.infer<typeof greetingResponseSchema>;
