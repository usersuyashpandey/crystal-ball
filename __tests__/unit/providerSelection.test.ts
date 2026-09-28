/**
 * Which provider serves a request. Auto order is Anthropic -> OpenAI ->
 * Gemini -> Groq -> offline mock; LLM_PROVIDER forces one (e.g. to use Gemini's
 * free tier while an Anthropic key without credit is still in .env.local).
 */
export {};

const ORIGINAL_ENV = { ...process.env };

function fakeProvider(name: string) {
  return {
    name,
    streamComplete: jest.fn(async ({ onToken }: { onToken: (t: string) => void }) => {
      onToken(`from ${name}`);
      return { fullText: `from ${name}` };
    }),
  };
}

async function servedBy(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV };
  for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "LLM_PROVIDER"]) delete process.env[k];
  Object.assign(process.env, env);
  jest.resetModules();
  jest.doMock("@/lib/llm/providers/anthropic", () => ({ anthropicProvider: fakeProvider("anthropic") }));
  jest.doMock("@/lib/llm/providers/openai", () => ({ openaiProvider: fakeProvider("openai") }));
  jest.doMock("@/lib/llm/providers/gemini", () => ({ geminiProvider: fakeProvider("gemini") }));
  jest.doMock("@/lib/llm/providers/groq", () => ({ groqProvider: fakeProvider("groq") }));
  const { streamCompletion } = await import("@/lib/llm");
  const result = await streamCompletion({
    system: "<promptKind>greeting</promptKind>\n<queue>\n[]\n</queue>",
    messages: [{ role: "user", content: "hi" }],
  });
  return result.mode === "mock" ? "mock" : result.fullText.replace("from ", "");
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("provider selection", () => {
  it("uses Gemini when it's the only key configured", async () => {
    expect(await servedBy({ GEMINI_API_KEY: "g" })).toBe("gemini");
  });

  it("uses Groq when it's the only key configured", async () => {
    expect(await servedBy({ GROQ_API_KEY: "q" })).toBe("groq");
  });

  it("LLM_PROVIDER=groq forces Groq over an Anthropic key without credit", async () => {
    expect(await servedBy({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g", GROQ_API_KEY: "q", LLM_PROVIDER: "groq" })).toBe("groq");
  });

  it("keeps Claude first in the automatic order", async () => {
    expect(await servedBy({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" })).toBe("anthropic");
  });

  it("LLM_PROVIDER forces a provider even when an earlier key is present", async () => {
    expect(await servedBy({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g", LLM_PROVIDER: "gemini" })).toBe("gemini");
  });

  it("LLM_PROVIDER=mock forces the offline mock", async () => {
    expect(await servedBy({ ANTHROPIC_API_KEY: "a", LLM_PROVIDER: "mock" })).toBe("mock");
  });

  it("falls back to the mock if the forced provider has no key", async () => {
    expect(await servedBy({ ANTHROPIC_API_KEY: "a", LLM_PROVIDER: "gemini" })).toBe("mock");
  });
});

describe("provider failures are logged server-side", () => {
  it("logs the provider name and error, never the key", async () => {
    process.env = { ...ORIGINAL_ENV, ANTHROPIC_API_KEY: "sk-ant-secret-value", NODE_ENV: "development" };
    jest.resetModules();
    const err = Object.assign(new Error("Your credit balance is too low"), { status: 400 });
    jest.doMock("@/lib/llm/providers/anthropic", () => ({
      anthropicProvider: { name: "anthropic", streamComplete: jest.fn().mockRejectedValue(err) },
    }));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});

    const { streamCompletion } = await import("@/lib/llm");
    const result = await streamCompletion({
      system: "<promptKind>greeting</promptKind>\n<queue>\n[]\n</queue>",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.mode).toBe("degraded");
    const logged = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("anthropic");
    expect(logged).toContain("credit balance is too low");
    expect(logged).not.toContain("sk-ant-secret-value");
    log.mockRestore();
  });
});
