/**
 * The Gemini provider is the OpenAI SDK pointed at Google's
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
              listeners.content?.("from Gemini");
              return "Hello from Gemini";
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
  process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: "g-key" };
  delete process.env.GEMINI_MODEL;
  jest.resetModules();
});
afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

it("calls Google's OpenAI-compatible endpoint with a free-tier Flash model by default", async () => {
  const { geminiProvider } = await import("@/lib/llm/providers/gemini");
  const tokens: string[] = [];
  const result = await geminiProvider.streamComplete({
    system: "sys",
    messages: [{ role: "user", content: "hi" }],
    onToken: (t) => tokens.push(t),
    signal: new AbortController().signal,
  });

  expect(constructed[0]).toEqual({ apiKey: "g-key", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" });
  expect(streamCalls[0].model).toBe("gemini-3.8-flash");
  expect(streamCalls[0].messages[0].role).toBe("system");
  expect(tokens.join("")).toBe("Hello from Gemini");
  expect(result.fullText).toBe("Hello from Gemini");
});

it("honors GEMINI_MODEL", async () => {
  process.env.GEMINI_MODEL = "gemini-3.5-flash-lite";
  const { geminiProvider } = await import("@/lib/llm/providers/gemini");
  await geminiProvider.streamComplete({
    system: "s",
    messages: [{ role: "user", content: "hi" }],
    onToken: () => {},
    signal: new AbortController().signal,
  });
  expect(streamCalls[0].model).toBe("gemini-3.5-flash-lite");
});
