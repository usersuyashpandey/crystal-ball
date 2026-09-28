import type { DoneFrame } from "./schemas";

/**
 * Client-side SSE reader for the four streaming assistant endpoints.
 * Hand-rolled with fetch + ReadableStream rather than `EventSource`, which
 * can only GET and can't send the JSON body (history/question) we need.
 *
 * Exactly one of onDone / onError is called per request, unless the
 * caller aborts it (a superseded request), in which case neither is.
 */

export interface StreamHandlers<TStructured> {
  onToken: (text: string) => void;
  onStructured: (data: TStructured) => void;
  onDone: (done: DoneFrame) => void;
  onError: (message: string) => void;
}

const CUT_OFF_MESSAGE = "The response was cut off before it finished. Try again.";

function isAbort(err: unknown, signal?: AbortSignal): boolean {
  return (err instanceof DOMException && err.name === "AbortError") || Boolean(signal?.aborted);
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
    if (isAbort(err, signal)) return;
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
  let sawDone = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let frameEnd = buffer.indexOf("\n\n");
      while (frameEnd !== -1) {
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);
        if (dispatchFrame(frame, handlers) === "done") sawDone = true;
        frameEnd = buffer.indexOf("\n\n");
      }
    }
  } catch (err) {
    if (isAbort(err, signal)) return;
    handlers.onError(err instanceof Error ? err.message : CUT_OFF_MESSAGE);
    return;
  }

  if (signal?.aborted) return;
  // The server always ends with a done frame; a stream that closes without
  // one was cut off, and leaving the UI in "streaming" would freeze it.
  if (!sawDone) handlers.onError(CUT_OFF_MESSAGE);
}

function dispatchFrame<TStructured>(frame: string, handlers: StreamHandlers<TStructured>): string | null {
  const eventMatch = frame.match(/^event: (.+)$/m);
  const dataMatch = frame.match(/^data: (.+)$/m);
  if (!eventMatch || !dataMatch) return null;

  let data: unknown;
  try {
    data = JSON.parse(dataMatch[1]);
  } catch {
    return null;
  }

  const event = eventMatch[1];
  switch (event) {
    case "token":
      handlers.onToken((data as { text: string }).text);
      break;
    case "structured":
      handlers.onStructured(data as TStructured);
      break;
    case "done":
      handlers.onDone(data as DoneFrame);
      break;
  }
  return event;
}
