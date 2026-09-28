# Crystal Ball Command Centre — Approvals Assistant

A working rebuild of OomniEye's "Approvals" assistant panel (Wave 2 take-home
assignment, Sr. Fullstack Developer — MERN + AI), with all five entry points
wired to a real LLM call: **Present me Summary**, **Talk to me**, **Help
me**, **Teach me**, and **Replay Greeting**.

## Scope decision (read this first)

The brief warns against doing all five actions shallowly. I went with
**three actions at full depth, two intentionally lighter**:

- **Full depth:** Present me Summary, Talk to me, Help me (RAG). These get
  streaming, structured output checked against real data, dedicated
  prompts, and most of the test coverage.
- **Lighter, but working:** Teach me and Replay Greeting. Both make real
  LLM calls through the same timeout/fallback path. They got less prompt
  iteration and fewer dedicated tests.

## Setup

```bash
npm install
cp .env.example .env.local   # optional — see below
npm run dev                  # http://localhost:3000
```

### Running without an API key

The app works with **no API key at all**. `lib/llm/index.ts` picks a
provider in this order: `ANTHROPIC_API_KEY` → `OPENAI_API_KEY` →
`GEMINI_API_KEY` → **offline mock provider**. The mock isn't placeholder text: it reads the same
`<queue>`/`<policy>` context every real prompt embeds (`prompts/context.ts`)
and answers from the actual fixture data, streamed word by word so the
token-by-token UI is exercised either way.

A badge under each answer (`ModeBadge`) shows which path served it:
**Live model**, **Offline mock**, or **Degraded fallback**. If the model
answered but its structured part was unusable, a note says the list or
citations are the built-in fallback.

To use a real model, set one key in `.env.local`:

- `ANTHROPIC_API_KEY`: Claude, default `claude-sonnet-5-5`
  (`ANTHROPIC_MODEL` to override). The brief's primary option.
- `OPENAI_API_KEY`: GPT-4o by default (`OPENAI_MODEL`).
- `GEMINI_API_KEY`: Google Gemini, default `gemini-flash-latest`
  (`GEMINI_MODEL`). The brief doesn't name Gemini; it's included because
  its free tier needs no card, which makes it the easy way to try the app
  against a real model. Get a key at https://aistudio.google.com/apikey.

The automatic order is Anthropic → OpenAI → Gemini → mock. Set
`LLM_PROVIDER` (`anthropic` | `openai` | `gemini` | `mock`) to force one,
for example when an Anthropic key is present but has no credit. If a live
call fails, the server logs the provider and its error message, never the
key, so "Degraded fallback" in the panel always has a visible cause.

### Tests

```bash
npm test                # Jest (unit + integration), then Vitest (client + component)
npm run test:unit       # Jest only
npm run test:component  # Vitest only
npm run typecheck
npm run build
```

109 tests, all passing: 82 under Jest, 27 under Vitest.

## Architecture

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript strict,
  Tailwind. `components/ApprovalsAssistantPanel.tsx` is the panel: header
  with info / expand / close, the four action cards, Replay Greeting, a
  footer with the pending count, and read-aloud for the summary (Web Speech
  API). `components/QueueDashboard.tsx` is a simplified backdrop; the brief
  only asks for the panel.
- **State:** Zustand (`lib/store.ts`). Per action: status
  (idle → loading → streaming → done | error), text, validated structured
  payload, `mode`, and `structuredSource`. Starting a request aborts any
  earlier one for the same action, and late tokens from it are ignored.
- **Streaming:** SSE over `fetch` + `ReadableStream` (`lib/streamClient.ts`,
  `lib/api/respondStream.ts`) rather than `EventSource`, which can't POST a
  JSON body. Frames: `token`*, `structured`, `done { mode,
  structuredSource }`. A stream that closes without `done` is treated as an
  error, so the UI can't sit in "streaming" forever. Replay Greeting is a
  plain JSON response.
- **Backend:** Next.js Route Handlers (`app/api/assistant/*/route.ts`); the
  brief allows these in place of Express.
- **API contract:** Zod schemas in `lib/schemas.ts` are the source of
  truth; `openapi.yaml` is a hand-written mirror of them.
- **LLM integration:** `lib/llm/`: one `LLMProvider` interface. Anthropic
  uses its own SDK; OpenAI and Gemini share one OpenAI-compatible
  implementation; the offline mock is the fallback. Called server-side
  only; keys never reach the client.
- **Structured output:** each prompt asks for a short narrative, a
  `<<<STRUCTURED>>>` marker, then one JSON object. That's a single
  plain-text completion, so all three providers use the same format. The
  splitter (`lib/llm/streamSplitter.ts`) streams only the narrative and
  tolerates the marker without its newlines. The JSON is then extracted
  (fences and stray prose are fine), validated with Zod, and **checked
  against the data the model was given** (`lib/structuredChecks.ts`):
  - summary alerts must cover every queue item exactly once, with real ids;
  - Help citations are filtered to sections that were actually retrieved;
  - chat references are filtered to real items.

  Anything that fails is replaced by a local fallback, and the `done`
  frame says so.
- **RAG:** `lib/rag.ts`, keyword/TF scoring over the five sections of
  `content/approval-policy.md`, following the brief's "keyword retrieval
  over 3-5 chunks is sufficient". No embeddings.
- **Prompt versioning:** `prompts/*.ts`, versioned exports
  (`SUMMARY_PROMPT_V1`, …), not inline strings.
- **Rate limiting:** `lib/rateLimit.ts`, an in-memory sliding window: 30
  requests / 5 min per session cookie, plus 120 / 5 min per IP so dropping
  the cookie doesn't reset the allowance. 429s carry `Retry-After`. It's
  process-local and single-instance by design; more than one instance
  would need a shared store (e.g. Redis).

## Testing

Jest:

- **Unit** (`__tests__/unit`): `streamCompletion()` with the LLM provider
  mocked: `live`/`mock`/`degraded` selection, never throws, first-token
  and idle timeouts, a provider that ignores the abort signal, late tokens
  dropped, provider selection and `LLM_PROVIDER`, failures logged without
  the key. Also the Gemini provider (OpenAI SDK mocked), the splitter, JSON
  extraction, retrieval, heuristics, rate limiting, preflight, and the
  read-aloud helpers.
- **Integration** (`__tests__/integration`), via **Supertest**:
  `helpers/routeServer.ts` mounts an App Router handler on a real Node
  `http.Server` and streams its response back, so tests go over a socket.
  - Success path, 400 validation, and the fallback path (a failing
    provider still returns 200 with a usable payload, `mode: "degraded"`).
  - `liveModelOutput.test.ts` feeds the routes realistic imperfect model
    output: fenced JSON, marker without newlines, invented item ids, a
    dropped item, wrong enum values, invented citations. It asserts the UI
    either gets validated model data or is told it got the fallback.

Vitest + Testing Library:

- **Client** (`__tests__/client`): the SSE parser with frames split at
  arbitrary byte boundaries, cut-off streams, 429 and network errors,
  silent aborts; the store's cancellation of superseded streams, the
  language it sends, and retry without duplicate messages.
- **Component** (`__tests__/component`): the whole panel, driven by a
  hand-fed `ReadableStream`. Tests watch loading → partial text with cursor
  → done as bytes arrive, plus error → Retry, a mid-stream drop, the
  fallback note, Talk to me, header controls, footer and read-aloud.

**On test-first:** the first build (commits up to `2db97c5`) was written
implementation-first, with tests added afterwards. A review then found real
gaps, for example that the live-model path had never been tested. Every
fix since is red → green: each `test(red): …` commit adds failing tests,
and the next `fix(green)`/`feat(green)` commit makes them pass. `git log`
shows the pairs.

## AI-necessary vs. AI-unnecessary, fallback design, and what I'd change

Talk to me is the clearest AI-necessary case: free-form Q&A has no fixed
shape a template could cover. Help me needs AI to turn retrieved policy
text into a direct answer, but the grounding itself (keyword retrieval)
is deterministic, and the model's citations are checked against it. In
Present me Summary the urgency ranking is rule-based (`lib/heuristics.ts`:
SLA overdue-ness plus flags); the LLM adds the readable narrative in the
operator's language. Replay Greeting is the weakest case; a template
almost suffices, and it's the fallback.

Fallback design: 8s to the first token, then 8s maximum between tokens,
so long healthy answers aren't cut off. Failing before any output switches
to the grounded offline mock. Failing mid-stream stops with a short notice
rather than gluing on a second answer. Invalid structured output falls
back visibly (`structuredSource: "fallback"`). Generation failures never
become HTTP errors.

With more time: an eval suite running the prompts against a live key in
CI, Redis-backed rate limiting, and deeper tests for Teach me and Replay
Greeting.

## Assumptions made without asking

- The reference panel's four cards plus a separate "Replay Greeting" link
  (not a fifth card) is reproduced as-is.
- Queue timestamps are generated relative to "now" (`lib/queue.ts`)
  instead of the brief's literal "Sep 18", so the SLA maths stays
  meaningful whenever the demo runs.
- "Operator's language" is the browser's `navigator.language`; there's no
  in-app language picker.
- "Help me" answers one question at a time, per the brief's "a specific
  operational question"; Talk to me is the multi-turn one.

## AI tool usage

Built with Claude (Cowork): scaffolding, the LLM/prompt/streaming layers,
tests and this README. Three things it got wrong, each found by checking
behaviour rather than trusting that the code compiled:

- The first `<queue>`/`<policy>` extraction regex matched the literal tag
  in the prompt's own instructions, so "Help me" silently lost its
  retrieval context. Caught by curling the endpoints.
- The first version only ever ran against the offline mock. Probing with
  realistic model output showed fenced JSON being silently discarded and
  raw JSON leaking into the chat bubble.
- The skeleton "loading" state could never show in the app. The first
  component test only reached it by passing a hard-coded status prop.
