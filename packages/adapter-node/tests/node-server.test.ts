import http from "node:http";
import {
  createRequestHandler,
  createRouteMatcher,
  defineRenderer,
  type MatchRoute,
  type RequestRouteBinding,
  type RequestHandler
} from "@nusajs/core";
import { afterEach, describe, expect, it } from "vitest";
import { createNodeServer, type NodeServer } from "../src/index.js";

const encoder = new TextEncoder();

function bufferedRenderer(close: () => void = () => undefined) {
  return defineRenderer({
    id: "test-buffered",
    deliveries: new Set(["buffered"]),
    render: async ({ value }) => ({
      delivery: "buffered" as const,
      body: String(value),
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      close
    })
  });
}

function pipelineFor(
  bindings: readonly Readonly<RequestRouteBinding<MatchRoute, unknown, unknown, never>>[],
  renderer = bufferedRenderer()
) {
  const routes = bindings.map((binding) => binding.route);
  const matcher = createRouteMatcher(routes as readonly MatchRoute[]);
  return createRequestHandler({ matcher, renderer, bindings });
}

async function startServer(
  handler: Readonly<RequestHandler>,
  options: Record<string, unknown> = {}
) {
  const server = createNodeServer({ handler, ...options });
  const { port } = await server.listen({ port: 0, hostname: "127.0.0.1" });
  return { server, port, baseUrl: `http://127.0.0.1:${port}` };
}

function rawRequest(
  port: number,
  path: string,
  headers: Record<string, string>,
  method = "GET"
): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method, headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const running: NodeServer[] = [];

async function track<T extends { readonly server: NodeServer }>(result: T): Promise<T> {
  running.push(result.server);
  return result;
}

afterEach(async () => {
  while (running.length > 0) {
    const server = running.pop();
    if (server !== undefined) await server.shutdown();
  }
});

describe("node adapter server", () => {
  it("serves a page through the universal pipeline with dynamic parameters", async () => {
    const routes = [
      {
        kind: "page",
        pattern: "/blog/[slug]",
        segments: [
          { kind: "static", value: "blog" },
          { kind: "dynamic", value: "slug" }
        ],
        specificity: [4, 3],
        file: "blog/[slug].page.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        {
          route: routes[0],
          // biome-ignore lint/complexity/useLiteralKeys: strict index-signature access requires brackets.
          load: (context) => `Post: ${context.params["slug"]}`
        }
      ]
    });
    const { server, baseUrl } = await track(await startServer(pipeline));
    const response = await fetch(`${baseUrl}/blog/hello`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Post: hello");
    await server.shutdown();
  });

  it("selects endpoint roles first and passes endpoint responses through", async () => {
    const routes = [
      {
        kind: "endpoint",
        pattern: "/health",
        segments: [{ kind: "static", value: "health" }],
        specificity: [4],
        file: "health.endpoint.ts"
      },
      {
        kind: "page",
        pattern: "/health",
        segments: [{ kind: "static", value: "health" }],
        specificity: [4],
        file: "health.page.ts"
      }
    ] as const;
    const matcher = createRouteMatcher<(typeof routes)[number]>(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        { route: routes[0], handle: () => new Response("ok", { status: 200 }) },
        { route: routes[1], load: () => "page" }
      ]
    });
    const { server, baseUrl } = await track(await startServer(pipeline));
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
    await server.shutdown();
  });

  it("returns a plain-text 404 for missing routes and rejects page POSTs", async () => {
    const routes = [
      {
        kind: "page",
        pattern: "/",
        segments: [],
        specificity: [],
        file: "index.page.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [{ route: routes[0], load: () => "home" }]
    });
    const { server, baseUrl } = await track(await startServer(pipeline));
    const missing = await fetch(`${baseUrl}/nope`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("Not Found");
    const post = await fetch(`${baseUrl}/`, { method: "POST", body: "x" });
    expect(post.status).toBe(404);
    await server.shutdown();
  });

  it("omits the body for HEAD requests", async () => {
    const routes = [
      {
        kind: "page",
        pattern: "/",
        segments: [],
        specificity: [],
        file: "index.page.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [{ route: routes[0], load: () => "home" }]
    });
    const { server, baseUrl } = await track(await startServer(pipeline));
    const response = await fetch(`${baseUrl}/`, { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    await server.shutdown();
  });

  it("passes the raw pathname without decoding or repair", async () => {
    const routes = [
      {
        kind: "page",
        pattern: "/blog/[slug]",
        segments: [
          { kind: "static", value: "blog" },
          { kind: "dynamic", value: "slug" }
        ],
        specificity: [4, 3],
        file: "blog/[slug].page.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        {
          route: routes[0],
          // biome-ignore lint/complexity/useLiteralKeys: strict index-signature access requires brackets.
          load: (context) => context.params["slug"]
        }
      ]
    });
    const { server, baseUrl } = await track(await startServer(pipeline));
    const ok = await fetch(`${baseUrl}/blog/hello`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("hello");
    const encoded = await fetch(`${baseUrl}/blog%2Fadmin`);
    expect(encoded.status).toBe(404);
    const encodedTwice = await fetch(`${baseUrl}/blog/%252Fadmin`);
    expect(encodedTwice.status).toBe(404);
    await server.shutdown();
  });

  it("ignores forwarded headers unless trustProxy is configured", async () => {
    const routes = [
      {
        kind: "endpoint",
        pattern: "/info",
        segments: [{ kind: "static", value: "info" }],
        specificity: [4],
        file: "info.endpoint.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        {
          route: routes[0],
          handle: (context) =>
            new Response(
              JSON.stringify({
                url: context.request.url,
                proto: context.request.headers.get("x-forwarded-proto")
              })
            )
        }
      ]
    });
    const { server, baseUrl, port } = await track(await startServer(pipeline));
    const untrusted = await fetch(`${baseUrl}/info`, {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "evil.test" }
    });
    const untrustedBody = (await untrusted.json()) as { url: string };
    expect(untrustedBody.url).toBe(`http://127.0.0.1:${port}/info`);
    await server.shutdown();

    const trusted = await track(await startServer(pipeline, { trustProxy: true }));
    const trustedResponse = await fetch(`${trusted.baseUrl}/info`, {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "proxy.test" }
    });
    const trustedBody = (await trustedResponse.json()) as { url: string };
    expect(trustedBody.url).toBe("https://proxy.test/info");
    await trusted.server.shutdown();
  });

  it("rejects invalid host headers with 400", async () => {
    const routes = [
      {
        kind: "page",
        pattern: "/",
        segments: [],
        specificity: [],
        file: "index.page.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [{ route: routes[0], load: () => "home" }]
    });
    const { server, port } = await track(await startServer(pipeline));
    const result = await rawRequest(port, "/", { Host: "bad host" });
    expect(result.status).toBe(400);
    await server.shutdown();
  });

  it("rejects oversized declared bodies with 413 and overlong URLs with 414", async () => {
    const routes = [
      {
        kind: "page",
        pattern: "/",
        segments: [],
        specificity: [],
        file: "index.page.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [{ route: routes[0], load: () => "home" }]
    });
    const { server, baseUrl, port } = await track(
      await startServer(pipeline, { maxRequestSize: 128, maxUrlLength: 64 })
    );
    const oversized = await rawRequest(port, "/", { "content-length": "1024" }, "POST");
    expect(oversized.status).toBe(413);
    const longUrl = `${baseUrl}/${"a".repeat(200)}`;
    const response = await fetch(longUrl);
    expect(response.status).toBe(414);
    await server.shutdown();
  });

  it("streams response chunks in order with backpressure", async () => {
    const routes = [
      {
        kind: "page",
        pattern: "/stream",
        segments: [{ kind: "static", value: "stream" }],
        specificity: [4],
        file: "stream.page.ts"
      }
    ] as const;
    const _matcher = createRouteMatcher(routes);
    const renderer = defineRenderer({
      id: "test-streaming",
      deliveries: new Set(["streaming"]),
      render: async () => ({
        delivery: "streaming" as const,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode("first-"));
            setTimeout(() => controller.enqueue(encoder.encode("second")), 10);
            setTimeout(() => controller.close(), 20);
          }
        }),
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        close: () => undefined
      })
    });
    const pipeline = pipelineFor([{ route: routes[0], load: () => "stream" }], renderer);
    const { server, baseUrl } = await track(await startServer(pipeline));
    const response = await fetch(`${baseUrl}/stream`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("first-second");
    await server.shutdown();
  });

  it("streams request bodies into endpoints", async () => {
    const routes = [
      {
        kind: "endpoint",
        pattern: "/echo",
        segments: [{ kind: "static", value: "echo" }],
        specificity: [4],
        file: "echo.endpoint.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        {
          route: routes[0],
          handle: async (context) => new Response(await context.request.text())
        }
      ]
    });
    const { server, baseUrl } = await track(await startServer(pipeline));
    const response = await fetch(`${baseUrl}/echo`, {
      method: "POST",
      body: "hello body",
      headers: { "content-type": "text/plain" }
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("hello body");
    await server.shutdown();
  });

  it("propagates client aborts to renderer cleanup", async () => {
    const closed = { value: false };
    const routes = [
      {
        kind: "page",
        pattern: "/hang",
        segments: [{ kind: "static", value: "hang" }],
        specificity: [4],
        file: "hang.page.ts"
      }
    ] as const;
    const _matcher = createRouteMatcher(routes);
    const renderer = defineRenderer({
      id: "test-abort",
      deliveries: new Set(["streaming"]),
      render: async () => ({
        delivery: "streaming" as const,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode("first"));
          },
          cancel() {
            closed.value = true;
          }
        }),
        status: 200,
        headers: new Headers(),
        close: () => {
          closed.value = true;
        }
      })
    });
    const pipeline = pipelineFor([{ route: routes[0], load: () => "hang" }], renderer);
    const { server, baseUrl } = await track(await startServer(pipeline));
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/hang`, { signal: controller.signal });
    const reader = response.body?.getReader();
    await reader?.read();
    controller.abort();
    await waitFor(() => closed.value);
    expect(closed.value).toBe(true);
    await server.shutdown();
  });

  it("returns a redacted production diagnostic when the handler fails", async () => {
    let reported: { error: unknown; requestId: string } | undefined;
    const routes = [
      {
        kind: "endpoint",
        pattern: "/boom",
        segments: [{ kind: "static", value: "boom" }],
        specificity: [4],
        file: "boom.endpoint.ts"
      }
    ] as const;
    const matcher = createRouteMatcher(routes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        {
          route: routes[0],
          handle: () => {
            throw new Error("secret-token-abc123");
          }
        }
      ]
    });
    const { server, baseUrl } = await track(
      await startServer(pipeline, {
        onError: (error: unknown, requestId: string) => {
          reported = { error, requestId };
        }
      })
    );
    const response = await fetch(`${baseUrl}/boom`);
    expect(response.status).toBe(500);
    const body = (await response.json()) as { code: string; requestId: string };
    expect(body.code).toBe("NUSA-SERVER-0001");
    expect(body.requestId).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(JSON.stringify(body)).not.toContain("secret-token-abc123");
    expect(reported?.requestId).toBe(body.requestId);
    await server.shutdown();
  });

  it("aborts remaining in-flight requests during bounded graceful shutdown", async () => {
    const closed = { value: false };
    const routes = [
      {
        kind: "page",
        pattern: "/hang",
        segments: [{ kind: "static", value: "hang" }],
        specificity: [4],
        file: "hang.page.ts"
      }
    ] as const;
    const _matcher = createRouteMatcher(routes);
    const renderer = defineRenderer({
      id: "test-shutdown",
      deliveries: new Set(["streaming"]),
      render: async () => ({
        delivery: "streaming" as const,
        body: new ReadableStream<Uint8Array>({
          start() {
            closed.value = false;
          },
          cancel() {
            closed.value = true;
          }
        }),
        status: 200,
        headers: new Headers(),
        close: () => {
          closed.value = true;
        }
      })
    });
    const pipeline = pipelineFor([{ route: routes[0], load: () => "hang" }], renderer);
    const server = await track(await startServer(pipeline, { shutdownTimeoutMs: 200 }));
    const { port } = server;
    void fetch(`http://127.0.0.1:${port}/hang`).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const startedAt = Date.now();
    await server.server.shutdown();
    expect(Date.now() - startedAt).toBeLessThan(5000);
    await waitFor(() => closed.value, 2000);
    await expect(fetch(`http://127.0.0.1:${port}/hang`)).rejects.toThrow();
  });
});
