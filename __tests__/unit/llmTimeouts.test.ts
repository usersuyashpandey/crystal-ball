/**
 * Timeout semantics for streamCompletion(). The brief asks for an 8s
 * timeout; applying it to the *whole* response would kill long but healthy
 * streams. So: `timeoutMs` bounds time-to-first-token, `idleTimeoutMs`
 * bounds any stall between tokens, and a stream that breaks mid-way ends
 * with a notice — it is not stitched onto a second, unrelated answer.
 *
 * Real timers with small budgets, so these run in well under a second.
 */
export {};

const ORIGINAL_ENV = { ...process.env };
const GREETING_SYSTEM = "<promptKind>greeting</promptKind>\n<queue>\n[]\n</queue>";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type StreamArgs = { onToken: (t: string) => void; signal: AbortSignal };

async function withProvider(streamComplete: (args: StreamArgs) => Promise<{ fullText: string }>) {
  process.env = { ...ORIGINAL_ENV, ANTHROPIC_API_KEY: "test-key" };
  delete process.env.OPENAI_API_KEY;
  jest.resetModules();
  jest.doMock("@/lib/llm/providers/anthropic", () => ({
    anthropicProvider: { name: "anthropic", streamComplete },
  }));
  return (await import("@/lib/llm")).streamCompletion;
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("streamCompletion timeouts", () => {
  it("does not abort a healthy stream just because it runs longer than the first-token budget", async () => {
    const streamCompletion = await withProvider(async ({ onToken, signal }) => {
      let text = "";
      for (let i = 0; i < 8; i += 1) {
        await sleep(30); // 240ms total, each gap well under the idle budget
        // Like the real SDKs, stop as soon as we're aborted.
        if (signal.aborted) throw new Error("aborted");
        onToken(`w${i} `);
        text += `w${i} `;
      }
      return { fullText: text };
    });

    const options = { system: "s", messages: [{ role: "user" as const, content: "hi" }], timeoutMs: 100, idleTimeoutMs: 100 };
    const result = await streamCompletion(options);

    expect(result.mode).toBe("live");
    expect(result.fullText).toContain("w7");
  });

  it("ends a stream that stalls mid-way with a notice, without appending a second full answer", async () => {
    const streamCompletion = await withProvider(
      ({ onToken, signal }) =>
        new Promise((_resolve, reject) => {
          onToken("Partial live answer");
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    const tokens: string[] = [];
    const options = {
      system: GREETING_SYSTEM,
      messages: [{ role: "user" as const, content: "hi" }],
      onToken: (t: string) => tokens.push(t),
      timeoutMs: 100,
      idleTimeoutMs: 50,
    };
    const result = await streamCompletion(options);
    const shown = tokens.join("");

    expect(result.mode).toBe("degraded");
    expect(shown).toContain("Partial live answer");
    expect(shown).toMatch(/interrupted/i);
    // The offline mock's greeting must not be glued onto the partial answer.
    expect(shown).not.toContain("Welcome back");
  });

  it("still degrades when a provider ignores the abort signal and never settles", async () => {
    const streamCompletion = await withProvider(() => new Promise(() => {}));

    const started = Date.now();
    const result = await streamCompletion({
      system: GREETING_SYSTEM,
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 50,
    });

    expect(result.mode).toBe("degraded");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("ignores tokens a misbehaving provider emits after it has been timed out", async () => {
    const streamCompletion = await withProvider(async ({ onToken }) => {
      onToken("first ");
      await sleep(120); // longer than the idle budget
      onToken("LATE TOKEN");
      return { fullText: "first LATE TOKEN" };
    });

    const tokens: string[] = [];
    const options = {
      system: GREETING_SYSTEM,
      messages: [{ role: "user" as const, content: "hi" }],
      onToken: (t: string) => tokens.push(t),
      timeoutMs: 100,
      idleTimeoutMs: 40,
    };
    await streamCompletion(options);
    await sleep(150);

    expect(tokens.join("")).not.toContain("LATE TOKEN");
  });
});
