/**
 * The Groq provider is the OpenAI SDK pointed at Groq's
 * OpenAI-compatible endpoint. The SDK is mocked; this checks we send the
 * request to the right place, with the right model, and stream tokens back.
 */
export {};

const ORIGINAL_ENV = { ...process.env };
const constructed: Array<{ apiKey?: string; baseURL?: string }> = [];
const streamCalls: Array<{ model: string; messages: Array<{ role: string }>; reasoning_effort?: string }> = [];

jest.mock("openai", () => ({
  __esModule: true,
  default: class {
    chat = {
      completions: {
        stream: (body: { model: string; messages: Array<{ role: string }>; reasoning_effort?: string }) => {
          streamCalls.push(body);
          const listeners: Record<string, (d: string) => void> = {};
          return {
            on: (event: string, cb: (d: string) => void) => {
              listeners[event] = cb;
            },
            finalContent: async () => {
              listeners.content?.("Hello ");
              listeners.content?.("from Groq");
              return "Hello from Groq";
            },
          };
        },
      },
    };
    constructor(opts: { apiKey?: string; baseURL?: string }) {
      constructed.push(opts);
    }
  },
}));

beforeEach(() => {
  constructed.length = 0;
  streamCalls.length = 0;
  process.env = { ...ORIGINAL_ENV, GROQ_API_KEY: "g-key" };
  delete process.env.GROQ_MODEL;
  jest.resetModules();
});
afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

it("calls Groq's OpenAI-compatible endpoint with gpt-oss-120b at low reasoning effort by default", async () => {
  const { groqProvider } = await import("@/lib/llm/providers/groq");
  const tokens: string[] = [];
  const result = await groqProvider.streamComplete({
    system: "sys",
    messages: [{ role: "user", content: "hi" }],
    onToken: (t) => tokens.push(t),
    signal: new AbortController().signal,
  });

  expect(constructed[0]).toEqual({ apiKey: "g-key", baseURL: "https://api.groq.com/openai/v1" });
  // Llama 3.3 70B was retired on Groq; gpt-oss-120b is a production model.
  expect(streamCalls[0].model).toBe("openai/gpt-oss-120b");
  // gpt-oss "thinks" before answering; low effort keeps first token well
  // inside the 8s budget (~0.5s measured).
  expect(streamCalls[0].reasoning_effort).toBe("low");
  expect(streamCalls[0].messages[0].role).toBe("system");
  expect(tokens.join("")).toBe("Hello from Groq");
  expect(result.fullText).toBe("Hello from Groq");
});

it("honors GROQ_MODEL", async () => {
  process.env.GROQ_MODEL = "qwen/qwen3.8-27b";
  const { groqProvider } = await import("@/lib/llm/providers/groq");
  await groqProvider.streamComplete({
    system: "s",
    messages: [{ role: "user", content: "hi" }],
    onToken: () => {},
    signal: new AbortController().signal,
  });
  expect(streamCalls[0].model).toBe("qwen/qwen3.8-27b");
  // reasoning_effort is only sent to the models that understand it.
  expect(streamCalls[0].reasoning_effort).toBeUndefined();
});
