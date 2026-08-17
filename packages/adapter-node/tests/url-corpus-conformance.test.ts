import http from "node:http";
import {
  createRequestHandler,
  createRouteMatcher,
  defineRenderer,
  type MatchRoute
} from "@nusajs/core";
import {
  adapterRejectionCorpus,
  rawPathnameCorpus,
  splitRequestTarget
} from "../../core/tests/malicious-url-corpus.js";
import { afterEach, describe, expect, it } from "vitest";
import { createNodeServer, type NodeServer } from "../src/index.js";

type PageRoute = MatchRoute & { readonly kind: "page" };

function route(
  pattern: string,
  segments: readonly Readonly<MatchRoute["segments"][number]>[],
  specificity: readonly number[]
): PageRoute {
  return Object.freeze({
    kind: "page",
    pattern,
    segments: Object.freeze(segments.map((segment) => Object.freeze({ ...segment }))),
    specificity: Object.freeze([...specificity]),
    file: `${pattern.slice(1) || "index"}.page.ts`
  });
}

const referenceRoutes: readonly PageRoute[] = Object.freeze([
  route("/", [], []),
  route("/[...rest]", [{ kind: "catch-all", value: "rest" }], [1]),
  route("/[[...rest]]", [{ kind: "optional-catch-all", value: "rest" }], [0])
]);

function rawRequest(
  port: number,
  path: string,
  method = "GET"
): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path, method }, (res) => {
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

const running: NodeServer[] = [];

afterEach(async () => {
  while (running.length > 0) {
    const server = running.pop();
    if (server !== undefined) await server.shutdown();
  }
});

describe("shared malicious URL corpus (adapter conformance)", () => {
  it("produces the same normalization decisions as the universal matcher", async () => {
    const matcher = createRouteMatcher(referenceRoutes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: defineRenderer({
        id: "corpus",
        deliveries: new Set(["buffered"]),
        render: async ({ value }) => ({
          delivery: "buffered" as const,
          body: String(value),
          status: 200,
          headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
          close: () => undefined
        })
      }),
      bindings: referenceRoutes.map((route) => ({
        route,
        load: () => `matched ${route.pattern}`
      }))
    });
    const server = createNodeServer({ handler: pipeline });
    running.push(server);
    const { port } = await server.listen({ port: 0, hostname: "127.0.0.1" });

    for (const entry of rawPathnameCorpus) {
      if (!entry.transportable) continue;
      const split = splitRequestTarget(entry.pathname);
      const expectedMatch = matcher.match(split, "page") !== undefined;
      const result = await rawRequest(port, entry.pathname);
      if (expectedMatch) {
        expect(result.status, entry.name).toBe(200);
      } else {
        expect(result.status, entry.name).toBeGreaterThanOrEqual(400);
        expect(result.status, entry.name).toBeLessThanOrEqual(499);
      }
    }
  });

  it("rejects non-origin-form request-targets at the transport boundary", async () => {
    const matcher = createRouteMatcher(referenceRoutes);
    const pipeline = createRequestHandler({
      matcher,
      renderer: defineRenderer({
        id: "corpus-reject",
        deliveries: new Set(["buffered"]),
        render: async ({ value }) => ({
          delivery: "buffered" as const,
          body: String(value),
          status: 200,
          headers: new Headers(),
          close: () => undefined
        })
      }),
      bindings: referenceRoutes.map((route) => ({ route, load: () => "matched" }))
    });
    const server = createNodeServer({ handler: pipeline });
    running.push(server);
    const { port } = await server.listen({ port: 0, hostname: "127.0.0.1" });

    for (const entry of adapterRejectionCorpus) {
      const result = await rawRequest(port, entry.target);
      expect(result.status, entry.name).toBe(400);
    }
  });
});
