import { describe, expect, it, vi } from "vitest";
import {
  createRequestHandler,
  createRouteMatcher,
  defineRenderer,
  type MatchRoute,
  type Renderer,
  type RequestContext
} from "../src/index.js";

const page = Object.freeze({
  kind: "page",
  pattern: "/items/[id]",
  segments: Object.freeze([
    Object.freeze({ kind: "static", value: "items" }),
    Object.freeze({ kind: "dynamic", value: "id" })
  ]),
  specificity: Object.freeze([4, 3]),
  file: "items/[id].page.ts"
} as const satisfies MatchRoute);
const endpoint = Object.freeze({
  kind: "endpoint",
  pattern: "/items/[id]",
  segments: page.segments,
  specificity: page.specificity,
  file: "items/[id].endpoint.ts"
} as const satisfies MatchRoute);

function matcherWithBothRoles() {
  return createRouteMatcher<typeof page | typeof endpoint>([page, endpoint]);
}

function bufferedRenderer(
  close: () => void | Promise<void> = () => undefined
): Renderer<string, { readonly name: string }> {
  return defineRenderer({
    id: "test",
    deliveries: new Set(["buffered"]),
    render: async ({ value }) => ({
      delivery: "buffered",
      body: value,
      status: 201,
      headers: new Headers({ "x-rendered": "yes" }),
      close
    })
  });
}

function input(method = "GET", pathname = "/items/42") {
  return {
    request: new Request(`https://example.test${pathname}`, { method }),
    pathname,
    env: { name: "test" },
    requestId: "request_1234"
  };
}

describe("universal request handler", () => {
  it("copies and freezes complete identity-based bindings", () => {
    const matcher = matcherWithBothRoles();
    const bindings = [
      { route: page, load: () => "page" },
      { route: endpoint, handle: () => new Response("endpoint") }
    ];
    const pipeline = createRequestHandler({ matcher, bindings, renderer: bufferedRenderer() });
    bindings.length = 0;
    expect(pipeline.bindings).toHaveLength(2);
    expect(Object.isFrozen(pipeline)).toBe(true);
    expect(Object.isFrozen(pipeline.bindings)).toBe(true);
    expect(pipeline.bindings.every(Object.isFrozen)).toBe(true);
  });

  it("rejects foreign, duplicate, missing, and role-invalid bindings synchronously", () => {
    const matcher = matcherWithBothRoles();
    const clone = { ...page };
    expect(() =>
      createRequestHandler({
        matcher,
        renderer: bufferedRenderer(),
        bindings: [
          { route: clone, load: () => "page" },
          { route: endpoint, handle: () => new Response() }
        ]
      })
    ).toThrow("[NUSA-CONFIG-0001]");
    expect(() =>
      createRequestHandler({
        matcher,
        renderer: bufferedRenderer(),
        bindings: [
          { route: page, load: () => "page" },
          { route: page, load: () => "duplicate" }
        ]
      })
    ).toThrow("[NUSA-CONFIG-0001]");
    expect(() =>
      createRequestHandler({ matcher, renderer: bufferedRenderer(), bindings: [] })
    ).toThrow("[NUSA-CONFIG-0001]");
    expect(() =>
      createRequestHandler({
        matcher,
        renderer: bufferedRenderer(),
        bindings: [
          { route: page, load: undefined as never },
          { route: endpoint, handle: () => new Response() }
        ]
      })
    ).toThrow("[NUSA-CONFIG-0001]");
  });

  it.each(["GET", "HEAD", "POST"])("dispatches endpoints before pages for %s", async (method) => {
    const pageLoad = vi.fn(() => "page");
    const response = new Response("endpoint", { status: 202 });
    const matcher = matcherWithBothRoles();
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        { route: page, load: pageLoad },
        { route: endpoint, handle: () => response }
      ]
    });
    expect(await pipeline.handle(input(method))).toBe(response);
    expect(pageLoad).not.toHaveBeenCalled();
  });

  it("handles GET pages with isolated context and propagates metadata", async () => {
    const contexts: Readonly<RequestContext<{ readonly name: string }>>[] = [];
    const matcher = createRouteMatcher([page]);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        {
          route: page,
          load(context) {
            contexts.push(context);
            // biome-ignore lint/complexity/useLiteralKeys: strict index signatures prohibit property access.
            return `${context.env.name}:${context.params["id"]}`;
          }
        }
      ]
    });
    const first = await pipeline.handle(input());
    await pipeline.handle(input());
    expect(await first.text()).toBe("test:42");
    expect(first.status).toBe(201);
    expect(first.headers.get("x-rendered")).toBe("yes");
    expect(contexts).toHaveLength(2);
    expect(contexts[0]).not.toBe(contexts[1]);
    expect(contexts[0]?.locals).not.toBe(contexts[1]?.locals);
  });

  it("returns fresh plain-text 404 responses without creating context", async () => {
    const load = vi.fn(() => "page");
    const matcher = createRouteMatcher([page]);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [{ route: page, load }]
    });
    const malformed = await pipeline.handle(input("GET", "/items//42"));
    const post = await pipeline.handle(input("POST"));
    expect(malformed).not.toBe(post);
    expect(malformed.status).toBe(404);
    expect(malformed.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await malformed.text()).toBe("Not Found");
    expect(post.status).toBe(404);
    expect(load).not.toHaveBeenCalled();
  });

  it("returns HEAD page metadata without a body and closes once", async () => {
    const close = vi.fn();
    const matcher = createRouteMatcher([page]);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(close),
      bindings: [{ route: page, load: () => "hidden" }]
    });
    const response = await pipeline.handle(input("HEAD"));
    expect(response.status).toBe(201);
    expect(response.headers.get("x-rendered")).toBe("yes");
    expect(await response.text()).toBe("");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("propagates endpoint, loader, and renderer failures without creating 500 responses", async () => {
    const failure = new Error("application failure");
    const endpointMatcher = createRouteMatcher([endpoint]);
    const endpointPipeline = createRequestHandler({
      matcher: endpointMatcher,
      renderer: bufferedRenderer(),
      bindings: [{ route: endpoint, handle: () => Promise.reject(failure) }]
    });
    await expect(endpointPipeline.handle(input())).rejects.toBe(failure);
    const pageMatcher = createRouteMatcher([page]);
    const loaderPipeline = createRequestHandler({
      matcher: pageMatcher,
      renderer: bufferedRenderer(),
      bindings: [{ route: page, load: () => Promise.reject(failure) }]
    });
    await expect(loaderPipeline.handle(input())).rejects.toBe(failure);
    const rendererPipeline = createRequestHandler({
      matcher: pageMatcher,
      renderer: defineRenderer({
        id: "throws",
        deliveries: new Set(["buffered"]),
        render: () => Promise.reject(failure)
      }),
      bindings: [{ route: page, load: () => "page" }]
    });
    await expect(rendererPipeline.handle(input())).rejects.toBe(failure);
  });

  it("rejects invalid endpoint and renderer runtime results", async () => {
    const endpointMatcher = createRouteMatcher([endpoint]);
    const endpointPipeline = createRequestHandler({
      matcher: endpointMatcher,
      renderer: bufferedRenderer(),
      bindings: [{ route: endpoint, handle: () => "invalid" as never }]
    });
    await expect(endpointPipeline.handle(input())).rejects.toThrow("[NUSA-INTERNAL-0001]");
    const close = vi.fn();
    const pageMatcher = createRouteMatcher([page]);
    const pagePipeline = createRequestHandler({
      matcher: pageMatcher,
      renderer: defineRenderer({
        id: "invalid",
        deliveries: new Set(["buffered"]),
        render: async () =>
          ({
            delivery: "buffered",
            body: 123,
            status: 200,
            headers: new Headers(),
            close
          }) as never
      }),
      bindings: [{ route: page, load: () => "page" }]
    });
    await expect(pagePipeline.handle(input())).rejects.toThrow("[NUSA-INTERNAL-0001]");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("propagates explicit abort and waitUntil into the matching context", async () => {
    const controller = new AbortController();
    const waitUntil = vi.fn();
    let received: Readonly<RequestContext<{ readonly name: string }>> | undefined;
    const matcher = createRouteMatcher([page]);
    const pipeline = createRequestHandler({
      matcher,
      renderer: bufferedRenderer(),
      bindings: [
        {
          route: page,
          load(context) {
            received = context;
            return "page";
          }
        }
      ]
    });
    await pipeline.handle({ ...input(), signal: controller.signal, waitUntil });
    expect(received?.signal).toBe(controller.signal);
    expect(received?.waitUntil).toBe(waitUntil);
  });
});

describe("streaming request handler", () => {
  function streamingPipeline(
    stream: ReadableStream<Uint8Array>,
    close: () => void | Promise<void>,
    signal?: AbortSignal
  ) {
    const matcher = createRouteMatcher([page]);
    const renderer = defineRenderer<string, { readonly name: string }>({
      id: "stream",
      deliveries: new Set(["streaming"]),
      render: async () => ({
        delivery: "streaming",
        body: stream,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        close
      })
    });
    return {
      pipeline: createRequestHandler({
        matcher,
        renderer,
        bindings: [{ route: page, load: () => "" }]
      }),
      request: signal === undefined ? input() : { ...input(), signal }
    };
  }

  it("forwards bytes with backpressure and closes on completion", async () => {
    const pull = vi.fn();
    const close = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pull();
        if (pull.mock.calls.length === 1) controller.enqueue(new TextEncoder().encode("hello"));
        else controller.close();
      }
    });
    const { pipeline, request } = streamingPipeline(stream, close);
    const response = await pipeline.handle(request);
    expect(close).not.toHaveBeenCalled();
    expect(await response.text()).toBe("hello");
    expect(pull).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("cancels and closes on consumer cancellation", async () => {
    const cancel = vi.fn();
    const close = vi.fn();
    const reason = new Error("consumer stopped");
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const { pipeline, request } = streamingPipeline(stream, close);
    const response = await pipeline.handle(request);
    await response.body?.cancel(reason);
    expect(cancel).toHaveBeenCalledWith(reason);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("cancels and closes when the request aborts", async () => {
    const cancel = vi.fn();
    const close = vi.fn();
    const controller = new AbortController();
    const reason = new Error("request aborted");
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const { pipeline, request } = streamingPipeline(stream, close, controller.signal);
    const response = await pipeline.handle(request);
    controller.abort(reason);
    await expect(response.text()).rejects.toBe(reason);
    expect(cancel).toHaveBeenCalledWith(reason);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes and surfaces source failures", async () => {
    const close = vi.fn();
    const failure = new Error("source failed");
    const stream = new ReadableStream<Uint8Array>({ pull: () => Promise.reject(failure) });
    const { pipeline, request } = streamingPipeline(stream, close);
    const response = await pipeline.handle(request);
    await expect(response.text()).rejects.toBe(failure);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("cancels a streaming HEAD body instead of draining it", async () => {
    const cancel = vi.fn();
    const close = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const { pipeline } = streamingPipeline(stream, close);
    const response = await pipeline.handle(input("HEAD"));
    expect(response.body).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
