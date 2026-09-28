/**
 * A text/event-stream Response whose body the test feeds by hand, so a
 * test can assert on the UI *between* chunks — i.e. actually observe
 * streaming, instead of rendering a component with status="streaming".
 */
export function controllableSse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();

  return {
    response: new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    /** Raw bytes — use to split a frame across chunks. */
    push(raw: string) {
      controller.enqueue(encoder.encode(raw));
    },
    frame(event: string, data: unknown) {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    },
    close() {
      controller.close();
    },
  };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
