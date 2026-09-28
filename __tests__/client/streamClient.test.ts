import { describe, it, expect, vi, afterEach } from "vitest";
import { streamAssistantEndpoint } from "@/lib/streamClient";
import { controllableSse, jsonResponse } from "../helpers/fakeSse";

function recorder() {
  const calls: string[] = [];
  return {
    calls,
    handlers: {
      onToken: (t: string) => calls.push(`token:${t}`),
      onStructured: (d: unknown) => calls.push(`structured:${JSON.stringify(d)}`),
      onDone: (d: unknown) => calls.push(`done:${JSON.stringify(d)}`),
      onError: (m: string) => calls.push(`error:${m}`),
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("streamAssistantEndpoint", () => {
  it("reassembles SSE frames split at arbitrary byte boundaries, in order", async () => {
    const sse = controllableSse();
    vi.stubGlobal("fetch", vi.fn(async () => sse.response));
    const r = recorder();

    const done = streamAssistantEndpoint("/api/x", {}, r.handlers);
    sse.push('event: token\ndata: {"te');
    sse.push('xt":"Hel"}\n\nevent: tok');
    sse.push('en\ndata: {"text":"lo"}\n');
    sse.push('\nevent: structured\ndata: {"a":1}\n\n');
    sse.push('event: done\ndata: {"mode":"live","structuredSource":"model"}\n\n');
    sse.close();
    await done;

    expect(r.calls).toEqual([
      "token:Hel",
      "token:lo",
      'structured:{"a":1}',
      'done:{"mode":"live","structuredSource":"model"}',
    ]);
  });

  it("passes the whole done frame through, including structuredSource", async () => {
    const sse = controllableSse();
    vi.stubGlobal("fetch", vi.fn(async () => sse.response));
    const onDone = vi.fn();

    const done = streamAssistantEndpoint("/api/x", {}, { onToken() {}, onStructured() {}, onError() {}, onDone });
    sse.frame("done", { mode: "live", structuredSource: "fallback" });
    sse.close();
    await done;

    expect(onDone).toHaveBeenCalledWith({ mode: "live", structuredSource: "fallback" });
  });

  it("reports an error if the connection closes before the done frame — the UI must not stay 'streaming' forever", async () => {
    const sse = controllableSse();
    vi.stubGlobal("fetch", vi.fn(async () => sse.response));
    const r = recorder();

    const done = streamAssistantEndpoint("/api/x", {}, r.handlers);
    sse.frame("token", { text: "partial" });
    sse.close();
    await done;

    expect(r.calls[0]).toBe("token:partial");
    expect(r.calls[r.calls.length - 1]).toMatch(/^error:/);
  });

  it("surfaces the server's message for a 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(429, { error: "rate_limited", message: "Slow down." })));
    const r = recorder();
    await streamAssistantEndpoint("/api/x", {}, r.handlers);
    expect(r.calls).toEqual(["error:Slow down."]);
  });

  it("reports a network failure as an error instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const r = recorder();
    await expect(streamAssistantEndpoint("/api/x", {}, r.handlers)).resolves.toBeUndefined();
    expect(r.calls).toEqual(["error:Failed to fetch"]);
  });

  it("stays silent when the caller aborts (a superseded request is not an error)", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      await new Promise((_r, reject) =>
        init.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
      );
      throw new Error("unreachable");
    }));
    const r = recorder();

    const done = streamAssistantEndpoint("/api/x", {}, r.handlers, controller.signal);
    controller.abort();
    await done;

    expect(r.calls).toEqual([]);
  });
});
