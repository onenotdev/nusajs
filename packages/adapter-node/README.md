# `@nusajs/adapter-node`

Minimal Node.js adapter for the NusaJS universal request pipeline. It bridges `node:http` and the
universal `createRequestHandler()` contract, so routing, request isolation, rendering, and error
boundaries stay framework-owned and host-independent.

The adapter is Node-only by design and is not part of the universal package boundary.

```ts
import { createNodeServer } from "@nusajs/adapter-node";
import { createRequestHandler, createRouteMatcher, defineRenderer } from "@nusajs/core";

const page = {
  kind: "page",
  pattern: "/",
  segments: [],
  specificity: [],
  file: "index.page.ts"
} as const;

const pipeline = createRequestHandler({
  matcher: createRouteMatcher([page]),
  renderer: defineRenderer({
    id: "example",
    deliveries: new Set(["buffered"]),
    render: async ({ value }) => ({
      delivery: "buffered",
      body: String(value),
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      close: () => undefined
    })
  }),
  bindings: [{ route: page, load: () => "<h1>Hello from NusaJS</h1>" }]
});

const server = createNodeServer({ handler: pipeline });
await server.listen({ hostname: "127.0.0.1", port: 3000 });
```

## Request handling

- The raw request-target is passed to the pipeline unmodified as the raw pathname. The adapter
  never decodes, normalizes, or repairs URL paths; malformed HTTP is rejected by the maintained
  `node:http` parser.
- Forwarded headers are ignored unless `trustProxy: true` is set, and the `Host` header is
  validated before it participates in URL construction.
- `Content-Length` bodies above `maxRequestSize` receive `413`; oversized chunked bodies abort
  the request. Request-targets above `maxUrlLength` receive `414`.
- Client disconnects propagate through the request signal, so renderer cleanup and streaming
  cancellation follow the universal pipeline contract.
- Handler failures produce a redacted `500` whose JSON body contains only the allowlisted
  diagnostic code and a validated request identifier. Pass `onError` for your own redacted sink.

## Graceful shutdown

`server.shutdown()` stops accepting new connections, waits up to `shutdownTimeoutMs` for
in-flight requests, then aborts remaining requests and closes all connections.

```ts
await server.shutdown();
```

## Security defaults

| Option | Default | Notes |
|---|---|---|
| `trustProxy` | `false` | forwarded headers ignored unless enabled |
| `maxUrlLength` | 16 KiB | `414` above |
| `maxRequestSize` | 1 MiB | `413` above |
| `maxHeaderSize` | 16 KiB | forwarded to `node:http` |
| `maxHeadersCount` | 2000 | forwarded to `node:http` |
| `shutdownTimeoutMs` | 10 s | bounded in-flight wait |
| `createRequestId` | `randomUUID()` | URL-safe token for diagnostics |

Do not enable `trustProxy` unless the server is behind a proxy that strips incoming forwarded
headers. The host is the security boundary for absolute-URL construction.
