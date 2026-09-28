/**
 * The Groq provider is the OpenAI SDK pointed at Groq's
 * OpenAI-compatible endpoint. The SDK is mocked; this checks we send the
 * request to the right place, with the right model, and stream tokens back.
 */
export {};

const ORIGINAL_ENV = { ...process.env };
const constructed: Array<{ apiKey?: string; baseURL?: string }> = [];
const streamCalls: Array<{ model: string; messages: Array<{ role: string }> }> = [];

jest.mock("openai", () => ({
  __esModule: true,
  default: class {
    chat = {
      completions: {
        stream: (body: { model: string; messages: Array<{ role: string }> }) => {
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

it("calls Groq's OpenAI-compatible endpoint with Llama 3.3 70B by default", async () => {
  const { groqProvider } = await import("@/lib/llm/providers/groq");
  const tokens: string[] = [];
  const result = await groqProvider.streamComplete({
    system: "sys",
    messages: [{ role: "user", content: "hi" }],
    onToken: (t) => tokens.push(t),
    signal: new AbortController().signal,
  });

  expect(constructed[0]).toEqual({ apiKey: "g-key", baseURL: "https://api.groq.com/openai/v1" });
  expect(streamCalls[0].model).toBe("llama-3.3-70b-versatile");
  expect(streamCalls[0].messages[0].role).toBe("system");
  expect(tokens.join("")).toBe("Hello from Groq");
  expect(result.fullText).toBe("Hello from Groq");
});

it("honors GROQ_MODEL", async () => {
  process.env.GROQ_MODEL = "llama-3.1-8b-instant";
  const { groqProvider } = await import("@/lib/llm/providers/groq");
  await groqProvider.streamComplete({
    system: "s",
    messages: [{ role: "user", content: "hi" }],
    onToken: () => {},
    signal: new AbortController().signal,
  });
  expect(streamCalls[0].model).toBe("llama-3.1-8b-instant");
});
