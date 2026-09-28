import http from "node:http";

type RouteHandler = (req: Request) => Response | Promise<Response>;

/**
 * Serves a Next.js App Router handler — a plain `(Request) => Response`
 * function — from a real Node http.Server, so integration tests can drive it
 * with Supertest over an actual socket, as the brief asks.
 *
 * It converts the Node request into a Fetch Request and writes the Fetch
 * Response back chunk by chunk, so streamed (SSE) bodies go over the wire
 * as streams rather than being buffered by the adapter.
 */
export function serveRoute(handler: RouteHandler): http.Server {
  return http.createServer(async (nodeReq, nodeRes) => {
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) chunks.push(chunk as Buffer);

    const headers = new Headers();
    for (const [key, value] of Object.entries(nodeReq.headers)) {
      if (value === undefined) continue;
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const hasBody = nodeReq.method !== "GET" && nodeReq.method !== "HEAD" && chunks.length > 0;
    const request = new Request(`http://localhost${nodeReq.url}`, {
      method: nodeReq.method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    });

    const response = await handler(request);

    nodeRes.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key !== "set-cookie") nodeRes.setHeader(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) nodeRes.setHeader("set-cookie", cookies);

    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeRes.write(value);
      }
    }
    nodeRes.end();
  });
}
