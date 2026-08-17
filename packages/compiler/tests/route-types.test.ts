import { Buffer } from "node:buffer";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  createRouteManifest,
  generateRouteTypes,
  type RouteGraph,
  type RouteManifest
} from "../src/index.js";

const graph: RouteGraph = Object.freeze({
  routes: Object.freeze([
    Object.freeze({
      kind: "page",
      pattern: "/",
      collisionKey: "/",
      segments: Object.freeze([]),
      specificity: Object.freeze([]),
      file: "index.page.ts"
    }),
    Object.freeze({
      kind: "page",
      pattern: "/blog/[slug]/[[tab]]",
      collisionKey: "/blog/[]/[[]]",
      segments: Object.freeze([
        Object.freeze({ kind: "static", value: "blog" }),
        Object.freeze({ kind: "dynamic", value: "slug" }),
        Object.freeze({ kind: "optional", value: "tab" })
      ]),
      specificity: Object.freeze([4, 3, 2]),
      file: "blog/[slug]/[[tab]].page.ts"
    }),
    Object.freeze({
      kind: "endpoint",
      pattern: "/files/[...parts]",
      collisionKey: "/files/[...]",
      segments: Object.freeze([
        Object.freeze({ kind: "static", value: "files" }),
        Object.freeze({ kind: "catch-all", value: "parts" })
      ]),
      specificity: Object.freeze([4, 1]),
      file: "files/[...parts].endpoint.ts"
    }),
    Object.freeze({
      kind: "page",
      pattern: "/docs/[[...parts]]",
      collisionKey: "/docs/[[...]]",
      segments: Object.freeze([
        Object.freeze({ kind: "static", value: "docs" }),
        Object.freeze({ kind: "optional-catch-all", value: "parts" })
      ]),
      specificity: Object.freeze([4, 0]),
      file: "docs/[[...parts]].page.ts"
    })
  ]),
  boundaries: Object.freeze([])
});

async function loadGenerated(manifest = createRouteManifest(graph)) {
  const generated = generateRouteTypes(manifest);
  const javascript = ts.transpileModule(generated.code, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const url = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  return { generated, module: (await import(url)) as { href(id: string, params: object): string } };
}

describe("generateRouteTypes", () => {
  it("emits deterministic route IDs, exact parameter types, and stable source", () => {
    const manifest = createRouteManifest(graph);
    const first = generateRouteTypes(manifest);
    const reversed = generateRouteTypes({ ...manifest, routes: [...manifest.routes].reverse() });
    expect(first).toEqual(reversed);
    expect(first.routeIds).toEqual([...first.routeIds].sort());
    expect(first.code).toContain("export type RouteId =");
    expect(first.code).toContain('readonly "slug": string;');
    expect(first.code).toContain('readonly "tab"?: string;');
    expect(first.code).toContain('readonly "parts": readonly [string, ...string[]];');
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.routeIds)).toBe(true);
  });

  it("builds root, dynamic, optional, and catch-all pathnames with per-segment encoding", async () => {
    const manifest = createRouteManifest(graph);
    const { module } = await loadGenerated(manifest);
    const id = (pattern: string) =>
      manifest.routes.find((route) => route.pattern === pattern)?.id ?? "";
    expect(module.href(id("/"), {})).toBe("/");
    expect(module.href(id("/blog/[slug]/[[tab]]"), { slug: "a/b" })).toBe("/blog/a%2Fb");
    expect(module.href(id("/blog/[slug]/[[tab]]"), { slug: "café", tab: "new posts" })).toBe(
      "/blog/caf%C3%A9/new%20posts"
    );
    expect(module.href(id("/files/[...parts]"), { parts: ["a/b", "c"] })).toBe("/files/a%2Fb/c");
    expect(module.href(id("/docs/[[...parts]]"), {})).toBe("/docs");
  });

  it("fails closed for unknown IDs and missing, extra, or malformed parameters", async () => {
    const manifest = createRouteManifest(graph);
    const { module } = await loadGenerated(manifest);
    const blog = manifest.routes.find((route) => route.pattern.startsWith("/blog"))?.id ?? "";
    const files = manifest.routes.find((route) => route.pattern.startsWith("/files"))?.id ?? "";
    expect(() => module.href("r_unknown", {})).toThrow("NUSA-ROUTE-0001");
    expect(() => module.href(blog, {})).toThrow("slug must be a non-empty string");
    expect(() => module.href(blog, { slug: "ok", extra: "no" })).toThrow("unexpected parameter");
    expect(() => module.href(files, { parts: [] })).toThrow("non-empty string array");
    expect(() => module.href(files, { parts: ["ok", 1] })).toThrow("non-empty string");
  });

  it("rejects unsupported schemas and malformed or duplicate manifest routes", () => {
    const manifest = createRouteManifest(graph);
    const route = manifest.routes[0];
    if (route === undefined) throw new Error("fixture requires one route");
    expect(() =>
      generateRouteTypes({ ...manifest, version: 2 } as unknown as RouteManifest)
    ).toThrow("not supported");
    expect(() => generateRouteTypes({ ...manifest, routes: [route, route] })).toThrow(
      "invalid or duplicate route"
    );
    expect(() =>
      generateRouteTypes({
        ...manifest,
        routes: [{ ...route, id: "unsafe-id" }]
      })
    ).toThrow("invalid or duplicate route");
  });
});
