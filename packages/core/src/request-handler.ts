import type { Renderer, RenderResult, StreamingRenderResult } from "./renderer.js";
import type { RequestContext } from "./request-context.js";
import { createRequestContext } from "./request-context.js";
import type { MatchRoute, RouteMatcher } from "./route-matcher.js";

/** A page route and its request-local value loader. */
export interface PageRouteBinding<
  Route extends MatchRoute = MatchRoute,
  Value = unknown,
  Env = unknown
> {
  readonly route: Readonly<Route> & { readonly kind: "page" };
  readonly load: (context: Readonly<RequestContext<Env>>) => Value | Promise<Value>;
}

/** An endpoint route and its Web-Standard request handler. */
export interface EndpointRouteBinding<Route extends MatchRoute = MatchRoute, Env = unknown> {
  readonly route: Readonly<Route> & { readonly kind: "endpoint" };
  readonly handle: (context: Readonly<RequestContext<Env>>) => Response | Promise<Response>;
}

/** A role-specific application binding for one matcher route object. */
export type RequestRouteBinding<
  Route extends MatchRoute = MatchRoute,
  Value = unknown,
  Env = unknown
> = PageRouteBinding<Route, Value, Env> | EndpointRouteBinding<Route, Env>;

/** Immutable configuration used to create a universal request handler. */
export interface CreateRequestHandlerOptions<
  Route extends MatchRoute = MatchRoute,
  Value = unknown,
  Env = unknown
> {
  readonly matcher: Readonly<RouteMatcher<Route>>;
  readonly bindings: readonly Readonly<RequestRouteBinding<Route, Value, Env>>[];
  readonly renderer: Readonly<Renderer<Value, Env>>;
}

/** Request-local adapter input supplied to the universal pipeline. */
export interface HandleRequestInput<Env = unknown> {
  readonly request: Request;
  readonly pathname: string;
  readonly env: Env;
  readonly requestId: string;
  readonly signal?: AbortSignal;
  readonly waitUntil?: (promise: Promise<unknown>) => void;
}

/** A reusable, immutable universal request pipeline. */
export interface RequestHandler<
  Route extends MatchRoute = MatchRoute,
  Value = unknown,
  Env = unknown
> {
  readonly matcher: Readonly<RouteMatcher<Route>>;
  readonly bindings: readonly Readonly<RequestRouteBinding<Route, Value, Env>>[];
  readonly handle: (input: HandleRequestInput<Env>) => Promise<Response>;
}

const maximumBindings = 100_000;
const nullBodyStatuses = new Set([204, 205, 304]);

function configurationFailure(message: string): never {
  throw new TypeError(`[NUSA-CONFIG-0001] Invalid request handler: ${message}`);
}

function contractFailure(message: string): never {
  throw new TypeError(`[NUSA-INTERNAL-0001] Invalid request pipeline result: ${message}`);
}

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function copyBindings<Route extends MatchRoute, Value, Env>(
  matcher: Readonly<RouteMatcher<Route>>,
  bindings: readonly Readonly<RequestRouteBinding<Route, Value, Env>>[]
): {
  readonly bindings: readonly Readonly<RequestRouteBinding<Route, Value, Env>>[];
  readonly byRoute: ReadonlyMap<Readonly<Route>, Readonly<RequestRouteBinding<Route, Value, Env>>>;
} {
  if (bindings.length > maximumBindings) configurationFailure("binding count exceeds 100,000");
  if (bindings.length !== matcher.routes.length)
    configurationFailure("every matcher route requires exactly one binding");
  const routes = new Set<Readonly<Route>>(matcher.routes);
  const byRoute = new Map<Readonly<Route>, Readonly<RequestRouteBinding<Route, Value, Env>>>();
  const copies: Readonly<RequestRouteBinding<Route, Value, Env>>[] = [];
  for (const binding of bindings) {
    if (!isObject(binding) || !routes.has(binding.route))
      configurationFailure("binding route must use matcher route identity");
    if (byRoute.has(binding.route)) configurationFailure("duplicate route binding");
    let copy: Readonly<RequestRouteBinding<Route, Value, Env>>;
    if (binding.route.kind === "page") {
      const load = "load" in binding ? binding.load : undefined;
      if (typeof load !== "function") configurationFailure("page binding requires load");
      copy = Object.freeze({ route: binding.route, load }) as Readonly<
        RequestRouteBinding<Route, Value, Env>
      >;
    } else {
      const handle = "handle" in binding ? binding.handle : undefined;
      if (typeof handle !== "function") configurationFailure("endpoint binding requires handle");
      copy = Object.freeze({ route: binding.route, handle }) as Readonly<
        RequestRouteBinding<Route, Value, Env>
      >;
    }
    byRoute.set(binding.route, copy);
    copies.push(copy);
  }
  for (const route of matcher.routes) {
    if (!byRoute.has(route)) configurationFailure("matcher route is missing a binding");
  }
  return { bindings: Object.freeze(copies), byRoute };
}

function createContext<Env>(
  input: HandleRequestInput<Env>,
  params: Readonly<Record<string, string>>
): Readonly<RequestContext<Env>> {
  return createRequestContext({
    request: input.request,
    env: input.env,
    requestId: input.requestId,
    params,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
    ...(input.waitUntil === undefined ? {} : { waitUntil: input.waitUntil })
  });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}

function validateMetadata(
  result: RenderResult,
  renderer: Readonly<{ readonly deliveries: ReadonlySet<"buffered" | "streaming"> }>
): void {
  if (result.delivery !== "buffered" && result.delivery !== "streaming")
    contractFailure("unsupported renderer delivery");
  if (!renderer.deliveries.has(result.delivery))
    contractFailure("renderer returned an undeclared delivery");
  if (!Number.isInteger(result.status) || result.status < 200 || result.status > 599)
    contractFailure("renderer status must be an integer from 200 through 599");
  if (nullBodyStatuses.has(result.status))
    contractFailure("renderer status cannot prohibit its page body");
  if (!(result.headers instanceof Headers)) contractFailure("renderer headers must be Headers");
  if (result.delivery === "buffered" && typeof result.body !== "string")
    contractFailure("buffered renderer body must be a string");
  if (result.delivery === "streaming" && !(result.body instanceof ReadableStream))
    contractFailure("streaming renderer body must be a ReadableStream");
}

function closeGuard(close: () => void | Promise<void>): () => Promise<void> {
  let closing: Promise<void> | undefined;
  return (): Promise<void> => {
    closing ??= Promise.resolve().then(close);
    return closing;
  };
}

async function convertBuffered(
  result: Extract<RenderResult, { readonly delivery: "buffered" }>,
  close: () => Promise<void>,
  head: boolean
): Promise<Response> {
  try {
    return new Response(head ? null : result.body, {
      status: result.status,
      headers: result.headers
    });
  } finally {
    await close();
  }
}

async function cancelAndClose(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  close: () => Promise<void>,
  reason: unknown
): Promise<void> {
  try {
    await reader.cancel(reason);
  } finally {
    try {
      reader.releaseLock();
    } finally {
      await close();
    }
  }
}

function bridgeStream(
  result: StreamingRenderResult,
  signal: AbortSignal,
  close: () => Promise<void>
): ReadableStream<Uint8Array> {
  const reader = result.body.getReader();
  let terminal: Promise<void> | undefined;
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const removeAbort = (): void => signal.removeEventListener("abort", abort);
  const finish = (reason: unknown): Promise<void> => {
    terminal ??= (async (): Promise<void> => {
      removeAbort();
      await cancelAndClose(reader, close, reason);
    })();
    return terminal;
  };
  const abort = (): void => {
    void finish(signal.reason).then(
      () => controller?.error(signal.reason),
      (error: unknown) => controller?.error(error)
    );
  };
  const stream = new ReadableStream<Uint8Array>({
    start(value): void {
      controller = value;
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(value): Promise<void> {
      if (terminal !== undefined) return terminal;
      try {
        const next = await reader.read();
        if (terminal !== undefined) return terminal;
        if (next.done) {
          removeAbort();
          reader.releaseLock();
          terminal = close();
          await terminal;
          value.close();
          return;
        }
        if (!(next.value instanceof Uint8Array))
          contractFailure("streaming renderer chunks must be Uint8Array");
        value.enqueue(next.value);
      } catch (error) {
        try {
          await finish(error);
        } catch (cleanupError) {
          value.error(cleanupError);
          return;
        }
        value.error(error);
      }
    },
    async cancel(reason): Promise<void> {
      await finish(reason);
    }
  });
  return stream;
}

async function convertStreaming(
  result: StreamingRenderResult,
  signal: AbortSignal,
  close: () => Promise<void>,
  head: boolean
): Promise<Response> {
  const readerForHead = head ? result.body.getReader() : undefined;
  if (readerForHead !== undefined) {
    await cancelAndClose(readerForHead, close, "HEAD response body omitted");
    return new Response(null, { status: result.status, headers: result.headers });
  }
  const body = bridgeStream(result, signal, close);
  try {
    return new Response(body, { status: result.status, headers: result.headers });
  } catch (error) {
    await body.cancel(error);
    throw error;
  }
}

async function renderPage<Value, Env>(
  renderer: Readonly<Renderer<Value, Env>>,
  value: Value,
  context: Readonly<RequestContext<Env>>,
  head: boolean
): Promise<Response> {
  context.signal.throwIfAborted();
  const unknownResult: unknown = await renderer.render({
    value,
    context,
    signal: context.signal
  });
  // biome-ignore lint/complexity/useLiteralKeys: strict index signatures require bracket access.
  if (!isObject(unknownResult) || typeof unknownResult["close"] !== "function")
    contractFailure("renderer must return a result with close");
  const result = unknownResult as unknown as RenderResult;
  const close = closeGuard(result.close);
  try {
    validateMetadata(result, renderer);
    context.signal.throwIfAborted();
    return result.delivery === "buffered"
      ? await convertBuffered(result, close, head)
      : await convertStreaming(result, context.signal, close, head);
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * Creates one universal endpoint-first request pipeline from immutable route bindings.
 *
 * Adapters must pass the raw pathname separately from `request.url`. Endpoint responses pass
 * through unchanged. Page rendering supports buffered and backpressure-aware streaming output;
 * renderer cleanup runs exactly once after buffered conversion or stream completion/cancellation.
 */
export function createRequestHandler<Route extends MatchRoute, Value, Env>(
  options: CreateRequestHandlerOptions<Route, Value, Env>
): Readonly<RequestHandler<Route, Value, Env>> {
  if (!isObject(options)) configurationFailure("options must be an object");
  const { matcher, renderer } = options;
  if (!isObject(matcher) || !Array.isArray(matcher.routes) || typeof matcher.match !== "function") {
    configurationFailure("matcher must be a RouteMatcher");
  }
  if (!Array.isArray(options.bindings)) configurationFailure("bindings must be an array");
  if (
    !isObject(renderer) ||
    typeof renderer.render !== "function" ||
    !(renderer.deliveries instanceof Set)
  ) {
    configurationFailure("renderer must satisfy the renderer contract");
  }
  const copied = copyBindings<Route, Value, Env>(matcher, options.bindings);
  const handle = async (input: HandleRequestInput<Env>): Promise<Response> => {
    if (!isObject(input) || typeof input.pathname !== "string")
      configurationFailure("invocation must include a raw pathname");
    const endpointMatch = matcher.match(input.pathname, "endpoint");
    if (endpointMatch !== undefined) {
      const binding = copied.byRoute.get(endpointMatch.route);
      const endpointHandle =
        binding !== undefined && "handle" in binding ? binding.handle : undefined;
      if (binding === undefined || binding.route.kind !== "endpoint" || !endpointHandle)
        contractFailure("matched endpoint binding is unavailable");
      const response = await endpointHandle(createContext(input, endpointMatch.params));
      if (!(response instanceof Response)) contractFailure("endpoint must return a Response");
      return response;
    }
    if (input.request.method !== "GET" && input.request.method !== "HEAD") return notFound();
    const pageMatch = matcher.match(input.pathname, "page");
    if (pageMatch === undefined) return notFound();
    const binding = copied.byRoute.get(pageMatch.route);
    const pageLoad = binding !== undefined && "load" in binding ? binding.load : undefined;
    if (binding === undefined || binding.route.kind !== "page" || !pageLoad)
      contractFailure("matched page binding is unavailable");
    const context = createContext(input, pageMatch.params);
    context.signal.throwIfAborted();
    const value = await pageLoad(context);
    return renderPage(renderer, value, context, input.request.method === "HEAD");
  };
  return Object.freeze({ matcher, bindings: copied.bindings, handle });
}
