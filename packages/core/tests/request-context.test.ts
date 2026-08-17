import { describe, expect, it } from "vitest";
import { createRequestContext } from "../src/index.js";

describe("request context", () => {
  it("constructs the Web-Standard contract with immutable copied params", () => {
    const params = { id: "123" };
    const request = new Request("https://example.test/users/123");
    const env = { binding: "test" };
    const context = createRequestContext({ request, env, requestId: "request_1234", params });
    params.id = "changed";

    expect(context).toMatchObject({
      request,
      env,
      requestId: "request_1234",
      params: { id: "123" }
    });
    expect(context.url).not.toBe(new URL(request.url));
    expect(context.url.href).toBe(request.url);
    expect(context.signal).toBe(request.signal);
    expect(Object.getPrototypeOf(context.params)).toBeNull();
    expect(Object.isFrozen(context.params)).toBe(true);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("creates fresh request-local mutable state on every invocation", async () => {
    const request = new Request("https://example.test/");
    const contexts = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        Promise.resolve(
          createRequestContext({
            request,
            env: {},
            requestId: `request_${index.toString().padStart(4, "0")}`
          })
        )
      )
    );
    const key = Symbol("identity");
    contexts[0]?.locals.set(key, "first");

    expect(new Set(contexts.map((context) => context.locals)).size).toBe(100);
    expect(contexts.slice(1).every((context) => context.locals.has(key) === false)).toBe(true);
    expect(new Set(contexts.map((context) => context.url)).size).toBe(100);
  });

  it("propagates an explicit abort signal and waitUntil hook", () => {
    const controller = new AbortController();
    const pending: Promise<unknown>[] = [];
    const context = createRequestContext({
      request: new Request("https://example.test/"),
      env: undefined,
      requestId: "request_1234",
      signal: controller.signal,
      waitUntil: (promise) => pending.push(promise)
    });
    const task = Promise.resolve();
    context.waitUntil?.(task);
    controller.abort("cancelled");

    expect(context.signal.aborted).toBe(true);
    expect(context.signal.reason).toBe("cancelled");
    expect(pending).toEqual([task]);
  });

  it.each([
    "short",
    "spaces invalid",
    "slash/value",
    "a".repeat(129)
  ])("rejects unsafe request ID %s", (requestId) => {
    expect(() =>
      createRequestContext({ request: new Request("https://example.test/"), env: {}, requestId })
    ).toThrow(/NUSA-INTERNAL-0001/);
  });

  it("rejects prototype-sensitive parameter names without mutating prototypes", () => {
    const params = JSON.parse('{"__proto__":"unsafe"}') as Record<string, string>;
    expect(() =>
      createRequestContext({
        request: new Request("https://example.test/"),
        env: {},
        requestId: "request_1234",
        params
      })
    ).toThrow(/NUSA-SECURITY-0001/);
    expect(Object.prototype).not.toHaveProperty("unsafe");
  });
});
