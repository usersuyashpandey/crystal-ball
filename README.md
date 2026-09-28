# Crystal Ball Command Centre — Approvals Assistant

A working rebuild of OomniEye's "Approvals" assistant panel (Wave 2 take-home
assignment, Sr. Fullstack Developer — MERN + AI), with all five entry points
wired to a real LLM call: **Present me Summary**, **Talk to me**, **Help
me**, **Teach me**, and **Replay Greeting**.

## Scope decision (read this first)

The brief itself warns against doing all five actions shallowly. I went
with **three actions at full depth, two intentionally lighter**:

- **Full depth:** Present me Summary, Talk to me, Help me (RAG). These get
  streaming, structured output, dedicated prompts, and the bulk of the test
  coverage.
- **Lighter, but genuinely working:** Teach me and Replay Greeting. Both
  make real LLM calls and go through the same fallback/timeout machinery —
  they just got less prompt iteration and less dedicated test coverage,
  which I'd add first with more time.

This was a conscious trade-off to keep the three "harder" actions
(streaming state management, RAG grounding, structured JSON validation)
solid rather than spreading effort thin across all five.

## Setup

```bash
npm install
cp .env.example .env.local   # optional — see below
npm run dev                  # http://localhost:3000
```

### Running without an API key

The app works immediately with **no API key at all**. `lib/llm/index.ts`
picks a provider in this order: `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` →
**offline mock provider**. The mock isn't a placeholder — it reads the same
`<queue>`/`<policy>` context every real prompt embeds (`prompts/context.ts`)
and generates deterministic, grounded responses from the actual fixture
data, streamed word-by-word so the UI's token-by-token rendering is
genuinely exercised either way. A small badge in the panel (`ModeBadge`)
shows whether a given answer came from **Live model**, **Offline mock**, or
**Degraded fallback**, so it's visible in the UI which path served it.

To use a real model, set `ANTHROPIC_API_KEY` (default model:
`claude-sonnet-5`, override with `ANTHROPIC_MODEL`) or `OPENAI_API_KEY`
(default `gpt-4o`, override with `OPENAI_MODEL`) in `.env.local`.

### Tests

```bash
npm run test        # Jest (unit + integration) then Vitest (component)
npm run test:unit    # Jest only
npm run test:component  # Vitest only
npm run typecheck
npm run build
```

37 tests, all passing: 31 under Jest (unit + integration), 6 under Vitest
(component). See "Testing" below for what each layer actually covers.

## Architecture

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript strict mode,
  Tailwind. `components/ApprovalsAssistantPanel.tsx` is the panel itself;
  `components/QueueDashboard.tsx` + `app/page.tsx` are a simplified backdrop
  (the brief only asks for the panel, not the whole dashboard).
- **State:** Zustand (`lib/store.ts`) — one store holding panel open/view
  state and per-action status/narrative/structured/mode. No prop-drilling
  between the panel and its five views.
- **Streaming:** hand-rolled SSE over `fetch` + `ReadableStream`
  (`lib/streamClient.ts` client-side, `lib/api/respondStream.ts`
  server-side) — not `EventSource`, which can't POST a JSON body (needed
  for conversation history / questions). Four of the five actions stream;
  Replay Greeting is short enough to just be a single JSON response.
- **Backend:** Next.js Route Handlers (`app/api/assistant/*/route.ts`),
  chosen over a separate Express server since the brief explicitly allows
  it and it's one fewer moving part for a take-home.
- **API contract:** Zod schemas (`lib/schemas.ts`) are the source of truth;
  `openapi.yaml` is a hand-written mirror, per the brief's "OpenAPI-first
  spirit... doesn't need Swagger UI" note.
- **LLM integration:** `lib/llm/` — one `LLMProvider` interface, three
  implementations (Anthropic, OpenAI, offline mock), selected and wrapped
  with an 8s timeout + graceful degradation in `lib/llm/index.ts`. See
  "Fallback design" below.
- **Structured output:** every prompt (`prompts/*.ts`) asks for a short
  narrative, then an exact delimiter (`lib/llm/streamSplitter.ts`), then one
  JSON object — a single plain-text completion, no provider-specific
  JSON-mode or tool-use required, so Anthropic/OpenAI/mock all speak the
  same format. The JSON half is Zod-validated before it ever reaches the
  UI; a failed validation falls back to a locally-computed safe value
  (`lib/heuristics.ts` for Summary, retrieval-derived citations for Help),
  never raw model text.
- **RAG:** `lib/rag.ts` — keyword/TF scoring over `content/approval-policy.md`
  split into five headed sections, per the brief's explicit "keyword
  retrieval over 3-5 chunks is sufficient" guidance. No pgvector, no
  embeddings.
- **Prompt versioning:** `prompts/*.ts`, each a versioned export
  (`SUMMARY_PROMPT_V1`, etc.) — not inline strings in route handlers.
- **Rate limiting:** `lib/rateLimit.ts` — an in-memory per-session
  sliding-window log (30 requests / 5 min), not `express-rate-limit` (no
  Express here to hang it off). Explicitly not production-grade: it's
  process-local and resets on restart, which is fine for one instance and
  would need a shared store (Redis, etc.) behind more than one.

## Testing

- **Unit (Jest, LLM call mocked):** `__tests__/unit/llmFallback.test.ts`
  mocks the Anthropic provider directly to verify `streamCompletion()`
  picks the right mode (`live`/`mock`/`degraded`) and — critically — never
  throws, even when the provider rejects or hangs past the timeout. Also:
  `streamSplitter`, `rag`, `heuristics`, `rateLimit`, `preflight`.
- **Integration:** `__tests__/integration/{summary,help}Route.test.ts` call
  the exported route handler `POST` functions directly with a real Fetch
  `Request` and assert on the real `Response` — **not literally Supertest**.
  Supertest needs an `http.Server` to attach to, and a Next.js App Router
  route handler is just an exported `(req) => Response` function with no
  server of its own to boot in a test. Calling it directly exercises the
  exact same request/response contract Supertest would, without mocking
  Next internals. Both files cover the success path, a validation failure
  (400), and the fallback path (mocked provider that rejects still returns
  200 with a valid structured payload and `mode: "degraded"`).
- **Component (Vitest + Testing Library):**
  `__tests__/component/StreamingAnswer.test.tsx` covers loading (skeleton),
  streaming (partial text + cursor), done, and error (message + working
  retry button) for the shared answer component every single-shot action
  renders through.

## AI-necessary vs. AI-unnecessary, fallback design, and what I'd change

Talk to me is the clearest AI-necessary case — free-form Q&A has no fixed
shape a template could cover. Help me needs AI to synthesize retrieved
policy text into a direct answer, but the *grounding* itself (keyword
retrieval) is deliberately non-AI and deterministic. Present me Summary is
the most interesting case: the urgency ranking is actually rule-based
(`lib/heuristics.ts` — SLA overdue-ness plus flags), reused by both the
offline mock and as the structured-output fallback; what the LLM adds is
the readable narrative and language flexibility, not the ranking. Replay
Greeting is the weakest AI-necessity case of the five — a template would
almost suffice — kept LLM-backed only because the brief asked for a
"context-aware" regenerated greeting specifically.

Fallback design: every call gets an 8s timeout (`AbortController`); on
timeout or provider error, it degrades to the offline mock provider —
grounded in the same fixture data, not a blank error — rather than
throwing. The route layer never returns a raw 500 for a generation failure;
HTTP errors (400/429) only happen before any LLM call starts.

With more time: real (Redis-backed) rate limiting, full test depth on
Teach me/Replay Greeting, and citation-level relevance scoring in RAG
instead of TF/keyword matching.

## Assumptions made without asking

- The reference screenshot's four action cards plus a separate "Replay
  Greeting" link (not a fifth card) is reproduced as-is — that's the
  layout in the reference image.
- The mock queue's `submittedAt` timestamps are generated relative to
  "now" at process start (see `lib/queue.ts`) rather than hardcoded to the
  brief's literal "Sep 18" dates, so the demo doesn't look permanently
  stale whenever it's actually run.
- "Help me" resets to a fresh question rather than keeping a running
  thread — the brief describes it as answering "a specific operational
  question" (singular), whereas Talk to me is explicitly multi-turn.

## AI tool usage

Built with Claude (Cowork) end-to-end — scaffolding, the LLM
provider/prompt/streaming layer, tests, and this README. Notably, the
first draft of `prompts/context.ts`'s `<queue>`/`<policy>` extraction used
an unanchored regex that silently matched the *word* "policy" appearing in
a prompt's own instructions before the real data block — found by actually
curling every endpoint and watching "Help me" come back ungrounded, not by
code review or the type checker. Fixed by anchoring the regex on the tag
being followed by a newline. Worth mentioning per the JD's own emphasis on
using AI tools with judgment rather than as a checklist item: the fix
required noticing a UI-visible symptom didn't match what the code should
have done, not just accepting that it compiled and ran.
