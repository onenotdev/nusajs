import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse
} from "node:http";
import { Readable } from "node:stream";
import { formatProductionDiagnostic } from "@nusajs/core";
import type { MatchRoute, RequestHandler } from "@nusajs/core";

/** Configuration for a minimal Node.js adapter server. */
export interface NodeServerOptions<Env = unknown> {
  /** The universal request pipeline that serves every accepted request. */
  readonly handler: Readonly<RequestHandler<MatchRoute, unknown, Env>>;
  /**
   * Honors `X-Forwarded-Host` and `X-Forwarded-Proto` when the server runs behind a
   * trusted proxy. Defaults to `false`; forwarded headers are otherwise ignored.
   */
  readonly trustProxy?: boolean;
  /** Maximum raw request-target length in characters. Defaults to 16 KiB. */
  readonly maxUrlLength?: number;
  /** Maximum request body size in bytes. Defaults to 1 MiB. */
  readonly maxRequestSize?: number;
  /** Maximum HTTP header block size in bytes passed to `node:http`. Defaults to 16 KiB. */
  readonly maxHeaderSize?: number;
  /** Maximum HTTP header count passed to `node:http`. Defaults to 2000. */
  readonly maxHeadersCount?: number;
  /** Bounded grace period in milliseconds for in-flight requests during shutdown. */
  readonly shutdownTimeoutMs?: number;
  /** Creates fresh request-local environment state. Defaults to an empty object. */
  readonly createEnv?: () => Env;
  /** Creates a URL-safe request identifier. Defaults to `crypto.randomUUID()`. */
  readonly createRequestId?: () => string;
  /** Receives handled request failures with only the redacted request identifier. */
  readonly onError?: (error: unknown, requestId: string) => void;
}

/** The resolved listen address of a running Node adapter server. */
export interface NodeListenResult {
  readonly hostname: string;
  readonly port: number;
}

/** Options accepted by {@link NodeServer.listen}. */
export interface NodeListenOptions {
  readonly hostname?: string;
  readonly port?: number;
}

/**
 * A minimal Node.js server that bridges `node:http` and the universal request pipeline.
 *
 * The raw request-target is passed to the pipeline unmodified; malformed HTTP is rejected by
 * the maintained `node:http` parser. Client disconnects propagate through the pipeline signal.
 */
export interface NodeServer {
  /** The underlying `node:http` server. */
  readonly server: Readonly<HttpServer>;
  /** Starts listening and resolves with the bound address. */
  listen(options?: NodeListenOptions): Promise<NodeListenResult>;
  /** Stops accepting work, waits a bounded time, then aborts remaining requests. */
  shutdown(): Promise<void>;
}

interface AdapterState<Env> {
  readonly handler: Readonly<RequestHandler<MatchRoute, unknown, Env>>;
  readonly trustProxy: boolean;
  readonly maxUrlLength: number;
  readonly maxRequestSize: number;
  readonly shutdownTimeoutMs: number;
  readonly createEnv: () => Env;
  readonly createRequestId: () => string;
  readonly onError: ((error: unknown, requestId: string) => void) | undefined;
  readonly active: Set<AbortController>;
}

const defaultMaxUrlLength = 16 * 1024;
const defaultMaxRequestSize = 1024 * 1024;
const defaultMaxHeaderSize = 16 * 1024;
const defaultMaxHeadersCount = 2000;
const defaultShutdownTimeoutMs = 10_000;
const defaultHostname = "127.0.0.1";
const defaultPort = 3000;
const hostPattern = /^[A-Za-z0-9.\-:[\]]+$/;
const originFormPattern = /^\/(?!\/)/;

function configurationFailure(message: string): never {
  throw new TypeError(`[NUSA-CONFIG-0001] Invalid Node adapter: ${message}`);
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    configurationFailure(`${name} must be a positive integer`);
  }
  return value;
}

function headerValue(headers: IncomingMessage["headers"], name: string): string | undefined {
  const value = headers[name];
  return typeof value === "string" ? value : undefined;
}

function rawPathname(rawUrl: string): string {
  const fragment = rawUrl.search(/[?#]/);
  return fragment === -1 ? rawUrl : rawUrl.slice(0, fragment);
}

function resolveProtocol(req: IncomingMessage, trustProxy: boolean): "http" | "https" {
  if (trustProxy && headerValue(req.headers, "x-forwarded-proto") === "https") {
    return "https";
  }
  return "http";
}

function resolveHost(req: IncomingMessage, trustProxy: boolean): string | undefined {
  let host = headerValue(req.headers, "host");
  if (trustProxy) {
    const forwardedHost = headerValue(req.headers, "x-forwarded-host");
    if (forwardedHost !== undefined) host = forwardedHost;
  }
  if (host === undefined || host.length === 0 || host.length > 255 || !hostPattern.test(host)) {
    return undefined;
  }
  return host;
}

function declaredBodySize(req: IncomingMessage): number | undefined {
  const value = headerValue(req.headers, "content-length");
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function hasRequestBody(req: IncomingMessage): boolean {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const size = declaredBodySize(req);
  if (size !== undefined && size > 0) return true;
  return headerValue(req.headers, "transfer-encoding") !== undefined;
}

function limitRequestBody(
  body: ReadableStream<Uint8Array>,
  limit: number,
  controller: AbortController
): ReadableStream<Uint8Array> {
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, value): void {
        received += chunk.byteLength;
        if (received > limit) {
          controller.abort();
          value.error(
            new RangeError("[NUSA-SECURITY-0001] Request body exceeds the configured limit")
          );
          return;
        }
        value.enqueue(chunk);
      }
    })
  );
}

function writeStatus(res: ServerResponse, status: number, message: string): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(message));
  res.end(message);
}

function writeServerError(res: ServerResponse, requestId: string): void {
  const body = JSON.stringify(formatProductionDiagnostic("NUSA-ADAPTER-0001", requestId));
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.statusCode = 500;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", Buffer.byteLength(body));
  res.end(body);
}

function writeResponse(res: ServerResponse, response: Response, controller: AbortController): void {
  res.statusCode = response.status;
  const setCookie = response.headers.getSetCookie();
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") return;
    res.setHeader(name, value);
  });
  for (const cookie of setCookie) {
    res.appendHeader("set-cookie", cookie);
  }
  if (response.body === null) {
    res.end();
    return;
  }
  const body = Readable.fromWeb(
    response.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>
  );
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  body.on("error", (error: Error) => {
    controller.abort();
    res.destroy(error);
  });
  body.pipe(res);
}

function handleConnection<Env>(
  state: AdapterState<Env>,
  req: IncomingMessage,
  res: ServerResponse
): void {
  const controller = new AbortController();
  state.active.add(controller);
  const release = (): void => {
    state.active.delete(controller);
  };
  // A request stays in-flight until its response connection closes, not when the
  // pipeline promise resolves, so streaming bodies remain tracked during shutdown.
  res.once("close", release);
  const rawUrl = req.url ?? "/";
  if (rawUrl.length > state.maxUrlLength) {
    writeStatus(res, 414, "URI Too Long");
    release();
    return;
  }
  if (!originFormPattern.test(rawUrl)) {
    writeStatus(res, 400, "Bad Request");
    release();
    return;
  }
  const host = resolveHost(req, state.trustProxy);
  if (host === undefined) {
    writeStatus(res, 400, "Bad Request");
    release();
    return;
  }
  const size = declaredBodySize(req);
  if (size !== undefined && size > state.maxRequestSize) {
    writeStatus(res, 413, "Payload Too Large");
    release();
    return;
  }
  let url: URL;
  try {
    url = new URL(rawUrl, `${resolveProtocol(req, state.trustProxy)}://${host}`);
  } catch {
    writeStatus(res, 400, "Bad Request");
    release();
    return;
  }
  const body = hasRequestBody(req)
    ? limitRequestBody(
        Readable.toWeb(req) as ReadableStream<Uint8Array>,
        state.maxRequestSize,
        controller
      )
    : undefined;
  let request: Request;
  try {
    request = new Request(url, {
      method: req.method ?? "GET",
      headers: req.headers as Exclude<RequestInit["headers"], undefined>,
      ...(body === undefined ? {} : { body, duplex: "half" as const }),
      signal: controller.signal
    });
  } catch {
    writeStatus(res, 400, "Bad Request");
    release();
    return;
  }
  const requestId = state.createRequestId();
  const env = state.createEnv();
  state.handler
    .handle({
      request,
      pathname: rawPathname(rawUrl),
      env,
      requestId,
      signal: controller.signal
    })
    .then((response) => writeResponse(res, response, controller))
    .catch((error: unknown) => {
      state.onError?.(error, requestId);
      writeServerError(res, requestId);
    });
}

function listen(server: HttpServer, hostname: string, port: number): Promise<NodeListenResult> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new TypeError("[NUSA-INTERNAL-0001] Node adapter: server has no TCP address"));
        return;
      }
      resolve(Object.freeze({ hostname: address.address, port: address.port }));
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({ host: hostname, port });
  });
}

/**
 * Creates a minimal Node.js adapter server around a universal request handler.
 *
 * The server validates the request-target origin form and host header, enforces conservative
 * URL and body limits, passes the raw pathname to the pipeline, and converts pipeline responses
 * with streaming backpressure. Handler failures produce a redacted production diagnostic.
 */
export function createNodeServer<Env>(options: NodeServerOptions<Env>): Readonly<NodeServer> {
  if (options === null || typeof options !== "object") {
    configurationFailure("options must be an object");
  }
  const handler = options.handler;
  if (handler === null || typeof handler !== "object" || typeof handler.handle !== "function") {
    configurationFailure("handler must be a request handler");
  }
  const trustProxy = options.trustProxy ?? false;
  const maxUrlLength = positiveInteger(options.maxUrlLength ?? defaultMaxUrlLength, "maxUrlLength");
  const maxRequestSize = positiveInteger(
    options.maxRequestSize ?? defaultMaxRequestSize,
    "maxRequestSize"
  );
  const maxHeaderSize = positiveInteger(
    options.maxHeaderSize ?? defaultMaxHeaderSize,
    "maxHeaderSize"
  );
  if (maxHeaderSize < 1024) configurationFailure("maxHeaderSize must be at least 1024");
  const maxHeadersCount = positiveInteger(
    options.maxHeadersCount ?? defaultMaxHeadersCount,
    "maxHeadersCount"
  );
  const shutdownTimeoutMs = positiveInteger(
    options.shutdownTimeoutMs ?? defaultShutdownTimeoutMs,
    "shutdownTimeoutMs"
  );
  const state: AdapterState<Env> = {
    handler,
    trustProxy,
    maxUrlLength,
    maxRequestSize,
    shutdownTimeoutMs,
    createEnv: options.createEnv ?? (() => ({}) as Env),
    createRequestId: options.createRequestId ?? (() => randomUUID()),
    onError: options.onError,
    active: new Set<AbortController>()
  };
  const server = createServer({ maxHeaderSize }, (req, res) => {
    handleConnection(state, req, res);
  });
  server.maxHeadersCount = maxHeadersCount;
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (!server.listening || shuttingDown) return;
    shuttingDown = true;
    const closed = new Promise<void>((resolve) => {
      server.once("close", resolve);
    });
    server.close();
    server.closeIdleConnections();
    const deadline = Date.now() + state.shutdownTimeoutMs;
    while (state.active.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (state.active.size > 0) {
      for (const controller of state.active) controller.abort();
    }
    // Bounded shutdown force-closes every remaining connection, including idle
    // keep-alive sockets, so shutdown never depends on client cooperation.
    server.closeAllConnections();
    await closed;
  };
  return Object.freeze({
    server,
    listen: (listenOptions?: NodeListenOptions): Promise<NodeListenResult> =>
      listen(
        server,
        listenOptions?.hostname ?? defaultHostname,
        listenOptions?.port ?? defaultPort
      ),
    shutdown
  });
}
