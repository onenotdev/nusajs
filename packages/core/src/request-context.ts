/** Universal, isolated state for one request lifecycle. */
export interface RequestContext<Env = unknown> {
  readonly request: Request;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  readonly env: Env;
  readonly signal: AbortSignal;
  readonly requestId: string;
  readonly locals: Map<symbol, unknown>;
  readonly waitUntil?: (promise: Promise<unknown>) => void;
}

/** Input used to construct one fresh request context. */
export interface CreateRequestContextInput<Env = unknown> {
  readonly request: Request;
  readonly env: Env;
  readonly requestId: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly waitUntil?: (promise: Promise<unknown>) => void;
}

function validateRequestId(requestId: string): void {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) {
    throw new TypeError(
      "[NUSA-INTERNAL-0001] Invalid request context: requestId must be an 8-128 character URL-safe token"
    );
  }
}

function copyParams(
  params: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> {
  const copy = Object.create(null) as Record<string, string>;
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new TypeError("[NUSA-SECURITY-0001] Invalid request context: unsafe parameter name");
      }
      if (typeof value !== "string") {
        throw new TypeError(
          "[NUSA-INTERNAL-0001] Invalid request context: parameter values must be strings"
        );
      }
      copy[key] = value;
    }
  }
  return Object.freeze(copy);
}

/**
 * Creates fresh universal state for exactly one request lifecycle.
 *
 * The environment is retained by reference because host bindings may not be cloneable. Callers
 * must supply request-local environment state where mutation is possible.
 */
export function createRequestContext<Env>(
  input: CreateRequestContextInput<Env>
): Readonly<RequestContext<Env>> {
  if (!(input.request instanceof Request)) {
    throw new TypeError("[NUSA-INTERNAL-0001] Invalid request context: request must be a Request");
  }
  if (input.signal !== undefined && !(input.signal instanceof AbortSignal)) {
    throw new TypeError(
      "[NUSA-INTERNAL-0001] Invalid request context: signal must be an AbortSignal"
    );
  }
  validateRequestId(input.requestId);
  return Object.freeze({
    request: input.request,
    url: new URL(input.request.url),
    params: copyParams(input.params),
    env: input.env,
    signal: input.signal ?? input.request.signal,
    requestId: input.requestId,
    locals: new Map<symbol, unknown>(),
    ...(input.waitUntil === undefined ? {} : { waitUntil: input.waitUntil })
  });
}
