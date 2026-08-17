import {
  createRequestHandler,
  createRouteMatcher,
  defineRenderer,
  type MatchRoute
} from "@nusajs/core";
import {
  createNodeServer,
  type NodeListenResult,
  type NodeServer,
  type NodeServerOptions
} from "@nusajs/adapter-node";

const routes = [
  {
    kind: "page",
    pattern: "/",
    segments: [],
    specificity: [],
    file: "index.page.ts"
  }
] as const satisfies readonly MatchRoute[];
const matcher = createRouteMatcher(routes);
const renderer = defineRenderer({
  id: "type-test",
  deliveries: new Set(["buffered"]),
  render: async () => ({
    delivery: "buffered" as const,
    body: "<h1>hi</h1>",
    status: 200,
    headers: new Headers(),
    close: () => undefined
  })
});
const pipeline = createRequestHandler({
  matcher,
  renderer,
  bindings: [{ route: routes[0], load: () => "<h1>hi</h1>" }]
});

const options: NodeServerOptions = {
  handler: pipeline,
  trustProxy: false,
  maxUrlLength: 16_384,
  maxRequestSize: 1024 * 1024,
  maxHeaderSize: 16_384,
  maxHeadersCount: 2000,
  shutdownTimeoutMs: 10_000,
  createEnv: () => ({}),
  createRequestId: () => "request_1234",
  onError: (_error: unknown, _requestId: string) => undefined
};
const server: Readonly<NodeServer> = createNodeServer(options);
const listenResult: Promise<NodeListenResult> = server.listen({
  hostname: "127.0.0.1",
  port: 0
});
const shutdown: Promise<void> = server.shutdown();
server.server satisfies unknown;

void listenResult;
void shutdown;

// @ts-expect-error handler is required
createNodeServer({});

// @ts-expect-error handler must be a request handler
createNodeServer({ handler: { notAHandler: true } });

// @ts-expect-error limits must be numbers
createNodeServer({ handler: pipeline, maxRequestSize: "1MiB" });
