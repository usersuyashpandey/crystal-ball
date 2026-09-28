/**
 * Unit tests for lib/llm/index.ts's streamCompletion(), with the LLM call
 * itself mocked (brief §4: "at least one prompt/response handler, with the
 * LLM call mocked"). This is the one piece every route handler depends on
 * for the "Fallback design" requirement (§3): a timeout or provider error
 * must never bubble up as a raw failure.
 */

export {}; // no top-level imports otherwise — force module scope, not global

const ORIGINAL_ENV = { ...process.env };

describe("streamCompletion", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  it("uses the offline mock provider when no API key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { streamCompletion } = await import("@/lib/llm");

    const tokens: string[] = [];
    const result = await streamCompletion({
      system: "<promptKind>greeting</promptKind>\n<queue>\n[]\n</queue>",
      messages: [{ role: "user", content: "hi" }],
      onToken: (t) => tokens.push(t),
    });

    expect(result.mode).toBe("mock");
    expect(result.fullText.length).toBeGreaterThan(0);
  });

  it("calls the configured provider and reports mode 'live' on success", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    jest.resetModules();

    const streamComplete = jest.fn(async ({ onToken }: { onToken: (t: string) => void }) => {
      onToken("Hello ");
      onToken("world");
      return { fullText: "Hello world" };
    });
    jest.doMock("@/lib/llm/providers/anthropic", () => ({
      anthropicProvider: { name: "anthropic", streamComplete },
    }));

    const { streamCompletion } = await import("@/lib/llm");
    const tokens: string[] = [];
    const result = await streamCompletion({
      system: "system prompt",
      messages: [{ role: "user", content: "hi" }],
      onToken: (t) => tokens.push(t),
    });

    expect(streamComplete).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe("live");
    expect(result.fullText).toBe("Hello world");
    expect(tokens).toEqual(["Hello ", "world"]);
  });

  it("degrades to the mock provider — never throws — when the configured provider fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    jest.resetModules();

    jest.doMock("@/lib/llm/providers/anthropic", () => ({
      anthropicProvider: {
        name: "anthropic",
        streamComplete: jest.fn().mockRejectedValue(new Error("simulated network failure")),
      },
    }));

    const { streamCompletion } = await import("@/lib/llm");
    const result = await streamCompletion({
      system: "<promptKind>greeting</promptKind>\n<queue>\n[]\n</queue>",
      messages: [{ role: "user", content: "hi" }],
    });

    // The whole point of the fallback design: this must resolve, not throw,
    // and it must land on a distinguishable "degraded" mode rather than
    // silently pretending the failure never happened.
    expect(result.mode).toBe("degraded");
    expect(result.fullText.length).toBeGreaterThan(0);
  });

  it("aborts the provider call once the timeout elapses and still degrades gracefully", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    jest.resetModules();

    jest.doMock("@/lib/llm/providers/anthropic", () => ({
      anthropicProvider: {
        name: "anthropic",
        streamComplete: ({ signal }: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      },
    }));

    const { streamCompletion } = await import("@/lib/llm");
    const result = await streamCompletion({
      system: "<promptKind>greeting</promptKind>\n<queue>\n[]\n</queue>",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 20,
    });

    expect(result.mode).toBe("degraded");
  });
});
