export interface SseFrame {
  event: string;
  data: Record<string, unknown>;
}

export function parseSse(text: string): SseFrame[] {
  return text
    .split("\n\n")
    .filter((f) => f.trim().length > 0)
    .map((frame) => {
      const eventLine = frame.split("\n").find((l) => l.startsWith("event: ")) ?? "";
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: ")) ?? "";
      return {
        event: eventLine.replace("event: ", "").trim(),
        data: JSON.parse(dataLine.replace("data: ", "")),
      };
    });
}

export function summarize(frames: SseFrame[]) {
  return {
    narrative: frames
      .filter((f) => f.event === "token")
      .map((f) => f.data.text as string)
      .join(""),
    structured: frames.find((f) => f.event === "structured")?.data,
    done: frames.find((f) => f.event === "done")?.data,
  };
}

/**
 * Makes the Anthropic provider "reply" with exactly `text`, in a few chunks,
 * so route tests exercise the live-model code path (mode: "live") with
 * realistic, imperfect model output instead of the offline mock's
 * always-perfect format. Call before importing the route under test, after
 * jest.resetModules().
 */
export function mockAnthropicReply(text: string): void {
  process.env.ANTHROPIC_API_KEY = "test-key";
  jest.doMock("@/lib/llm/providers/anthropic", () => ({
    anthropicProvider: {
      name: "anthropic",
      streamComplete: async ({ onToken }: { onToken: (t: string) => void }) => {
        const size = Math.ceil(text.length / 4);
        for (let i = 0; i < text.length; i += size) onToken(text.slice(i, i + size));
        return { fullText: text };
      },
    },
  }));
}
