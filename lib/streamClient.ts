/**
 * Client-side SSE reader for the four streaming assistant endpoints.
 * Deliberately hand-rolled with fetch + ReadableStream rather than
 * `EventSource`: EventSource can only do GET and can't send a JSON body
 * (our conversation history/question), so it's not an option for a POST
 * streaming endpoint.
 */

export interface StreamHandlers<TStructured> {
  onToken: (text: string) => void;
  onStructured: (data: TStructured) => void;
  onDone: (mode: "live" | "mock" | "degraded") => void;
  onError: (message: string) => void;
}

export async function streamAssistantEndpoint<TStructured>(
  url: string,
  body: unknown,
  handlers: StreamHandlers<TStructured>,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    handlers.onError(err instanceof Error ? err.message : "Network error contacting the assistant.");
    return;
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    handlers.onError(message);
    return;
  }

  if (!res.body) {
    handlers.onError("The assistant didn't return a response body.");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let frameEnd = buffer.indexOf("\n\n");
      while (frameEnd !== -1) {
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);
        dispatchFrame(frame, handlers);
        frameEnd = buffer.indexOf("\n\n");
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    handlers.onError(err instanceof Error ? err.message : "Lost connection while streaming.");
  }
}

function dispatchFrame<TStructured>(frame: string, handlers: StreamHandlers<TStructured>): void {
  const eventMatch = frame.match(/^event: (.+)$/m);
  const dataMatch = frame.match(/^data: (.+)$/m);
  if (!eventMatch || !dataMatch) return;

  let data: unknown;
  try {
    data = JSON.parse(dataMatch[1]);
  } catch {
    return;
  }

  switch (eventMatch[1]) {
    case "token":
      handlers.onToken((data as { text: string }).text);
      break;
    case "structured":
      handlers.onStructured(data as TStructured);
      break;
    case "done":
      handlers.onDone((data as { mode: "live" | "mock" | "degraded" }).mode);
      break;
  }
}
