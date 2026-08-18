import type { RequestContext } from "./request-context.js";

/** Delivery forms supported by a renderer implementation. */
export type RendererDelivery = "buffered" | "streaming";

/** Immutable input passed to a renderer for one request. */
export interface RenderInput<Value = unknown, Env = unknown, Layout = never> {
  readonly value: Value;
  /** Renderer-specific layout values ordered from root to nearest child. */
  readonly layouts: readonly Layout[];
  readonly context: Readonly<RequestContext<Env>>;
  readonly signal: AbortSignal;
}

/** Buffered UTF-8 HTML produced before response commitment. */
export interface BufferedRenderResult {
  readonly delivery: "buffered";
  readonly body: string;
  readonly status: number;
  readonly headers: Headers;
  readonly close: () => void | Promise<void>;
}

/** Streaming HTML bytes produced with Web-Standard backpressure and cancellation. */
export interface StreamingRenderResult {
  readonly delivery: "streaming";
  readonly body: ReadableStream<Uint8Array>;
  readonly status: number;
  readonly headers: Headers;
  readonly close: () => void | Promise<void>;
}

/** Renderer output whose metadata is finalized before its body is committed. */
export type RenderResult = BufferedRenderResult | StreamingRenderResult;

/** Public implementation contract shared by every renderer. */
export interface Renderer<Value = unknown, Env = unknown, Layout = never> {
  readonly id: string;
  readonly deliveries: ReadonlySet<RendererDelivery>;
  readonly render: (input: RenderInput<Value, Env, Layout>) => Promise<RenderResult>;
}

function fail(message: string): never {
  throw new TypeError(`[NUSA-CONFIG-0001] Invalid renderer: ${message}`);
}

/**
 * Validates and freezes a renderer descriptor without importing a renderer implementation.
 *
 * Request-local state belongs only in `RenderInput`; descriptors must be safe to share globally.
 */
export function defineRenderer<Value, Env, Layout = never>(
  renderer: Renderer<Value, Env, Layout>
): Renderer<Value, Env, Layout> {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(renderer.id)) fail("id must be a lowercase slug");
  if (typeof renderer.render !== "function") fail("render must be a function");
  if (!(renderer.deliveries instanceof Set) || renderer.deliveries.size === 0) {
    fail("deliveries must be a non-empty Set");
  }
  for (const delivery of renderer.deliveries) {
    if (delivery !== "buffered" && delivery !== "streaming") fail("unsupported delivery");
  }
  return Object.freeze({
    id: renderer.id,
    deliveries: new Set(renderer.deliveries),
    render: renderer.render
  });
}
