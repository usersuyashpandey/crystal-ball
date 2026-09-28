import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAssistantStore } from "@/lib/store";
import { controllableSse } from "../helpers/fakeSse";

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  useAssistantStore.setState(useAssistantStore.getInitialState(), true);
});
afterEach(() => vi.unstubAllGlobals());

describe("assistant store", () => {
  it("drops a superseded summary stream instead of interleaving it with the new one", async () => {
    const first = controllableSse();
    const second = controllableSse();
    const responses = [first.response, second.response];
    vi.stubGlobal("fetch", vi.fn(async () => responses.shift()!));

    const store = useAssistantStore.getState();
    void store.runSummary();
    await tick();
    first.frame("token", { text: "OLD-" });
    await tick();

    // Operator re-opens Summary while the first one is still streaming.
    const secondRun = store.runSummary();
    await tick();
    first.frame("token", { text: "STALE" }); // must not land in the new run
    second.frame("token", { text: "NEW" });
    second.frame("structured", { alerts: [], generatedAt: "t" });
    second.frame("done", { mode: "mock", structuredSource: "model" });
    second.close();
    await secondRun;

    const { summary } = useAssistantStore.getState();
    expect(summary.narrative).toBe("NEW");
    expect(summary.status).toBe("done");
  });

  it("sends the operator's browser language with the summary request", async () => {
    const sse = controllableSse();
    const fetchMock = vi.fn(async () => sse.response);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { ...navigator, language: "hi-IN" });

    const run = useAssistantStore.getState().runSummary();
    sse.frame("done", { mode: "mock", structuredSource: "model" });
    sse.close();
    await run;

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.language).toBe("hi-IN");
  });

  it("records whether the structured payload came from the model or the fallback", async () => {
    const sse = controllableSse();
    vi.stubGlobal("fetch", vi.fn(async () => sse.response));

    const run = useAssistantStore.getState().runSummary();
    sse.frame("structured", { alerts: [], generatedAt: "t" });
    sse.frame("done", { mode: "live", structuredSource: "fallback" });
    sse.close();
    await run;

    const { summary } = useAssistantStore.getState();
    expect(summary.mode).toBe("live");
    expect(summary.structuredSource).toBe("fallback");
  });

  it("retrying a failed chat message resends it without duplicating it in the thread", async () => {
    const failing = controllableSse();
    const ok = controllableSse();
    const responses = [failing.response, ok.response];
    vi.stubGlobal("fetch", vi.fn(async () => responses.shift()!));

    const send = useAssistantStore.getState().sendChat("which first?");
    failing.close(); // cut off before done => error
    await send;
    expect(useAssistantStore.getState().chat.status).toBe("error");

    const retry = useAssistantStore.getState().retryChat();
    await tick();
    ok.frame("token", { text: "The drone video." });
    ok.frame("done", { mode: "mock", structuredSource: "model" });
    ok.close();
    await retry;

    const { messages } = useAssistantStore.getState().chat;
    expect(messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(messages[messages.length - 1]).toEqual({ role: "assistant", content: "The drone video." });
  });
});
