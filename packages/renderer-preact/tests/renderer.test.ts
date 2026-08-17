import { createElement } from "preact";
import { describe, expect, it } from "vitest";
import { createRequestContext } from "../../core/src/index.js";
import { createPreactRenderer, PREACT_RENDERER_ID } from "../src/index.js";

function context(signal?: AbortSignal) {
  return createRequestContext({
    request: new Request("https://example.test/"),
    env: {},
    requestId: "request_1234",
    ...(signal === undefined ? {} : { signal })
  });
}

describe("official Preact renderer", () => {
  it("implements deterministic buffered HTML without framework JavaScript", async () => {
    const renderer = createPreactRenderer();
    const requestContext = context();
    const result = await renderer.render({
      value: createElement("main", null, createElement("h1", null, "NusaJS")),
      context: requestContext,
      signal: requestContext.signal
    });

    expect(renderer.id).toBe(PREACT_RENDERER_ID);
    expect(renderer.deliveries).toEqual(new Set(["buffered"]));
    expect(result).toMatchObject({
      delivery: "buffered",
      body: "<main><h1>NusaJS</h1></main>",
      status: 200
    });
    expect(result.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(result.body).not.toMatch(/<script\b/i);
    await result.close();
    await result.close();
  });

  it.each([
    '"><script>alert(1)</script><img src=x onerror=alert(2)>',
    "</style><script>alert(1)</script>",
    "&quot;><svg/onload=alert(1)>",
    "javascript:alert(1)\u2028</script>"
  ])("escapes hostile text and attribute payload %s", async (payload) => {
    const renderer = createPreactRenderer();
    const requestContext = context();
    const result = await renderer.render({
      value: createElement("a", { href: `/search?q=${payload}`, title: payload }, payload),
      context: requestContext,
      signal: requestContext.signal
    });

    expect(result.body).not.toContain("<script");
    expect(result.body).not.toContain("<img");
    expect(result.body).not.toContain("<svg");
    expect(result.body).not.toContain('title=""><');
  });

  it("fails before rendering when the request is already aborted", async () => {
    const controller = new AbortController();
    controller.abort("client disconnected");
    const requestContext = context(controller.signal);

    await expect(
      createPreactRenderer().render({
        value: createElement("p", null, "never rendered"),
        context: requestContext,
        signal: controller.signal
      })
    ).rejects.toBe("client disconnected");
  });
});
