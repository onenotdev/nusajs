import { describe, expect, it } from "vitest";
import { parseRouteGraph, RouteParseError } from "../src/index.js";
import type { RouteFileKind, RouteFileRecord } from "../src/index.js";

function file(relativePath: string, kind: RouteFileKind = "page"): RouteFileRecord {
  return { relativePath, normalizedPath: relativePath.normalize("NFC"), kind };
}

describe("route parser and collision detection", () => {
  it("parses the accepted segment grammar, groups, roles, and boundaries", () => {
    const graph = parseRouteGraph([
      file("index.page.tsx"),
      file("about.page.tsx"),
      file("blog/[slug].page.tsx"),
      file("docs/[...path].page.tsx"),
      file("(marketing)/pricing.page.tsx"),
      file("[[lang]]/welcome.page.tsx"),
      file("files/[[...rest]].page.tsx"),
      file("api/users.endpoint.ts", "endpoint"),
      file("_layout.tsx", "layout"),
      file("blog/_error.tsx", "error"),
      file("blog/_loading.tsx", "loading")
    ]);

    expect(graph.routes.map((route) => [route.kind, route.pattern])).toEqual([
      ["endpoint", "/api/users"],
      ["page", "/blog/[slug]"],
      ["page", "/docs/[...path]"],
      ["page", "/files/[[...rest]]"],
      ["page", "/about"],
      ["page", "/pricing"],
      ["page", "/[[lang]]/welcome"],
      ["page", "/"]
    ]);
    expect(graph.boundaries).toEqual([
      { kind: "layout", scope: "/", file: "_layout.tsx" },
      { kind: "error", scope: "/blog", file: "blog/_error.tsx" },
      { kind: "loading", scope: "/blog", file: "blog/_loading.tsx" }
    ]);
    expect(Object.isFrozen(graph)).toBe(true);
    expect(graph.routes.every(Object.isFrozen)).toBe(true);
  });

  it("orders static, dynamic, optional, catch-all, and optional catch-all by specificity", () => {
    const graph = parseRouteGraph([
      file("optional/[[...value]].page.ts"),
      file("catch/[...value].page.ts"),
      file("maybe/[[value]].page.ts"),
      file("dynamic/[value].page.ts"),
      file("static/fixed.page.ts")
    ]);
    expect(graph.routes.map((route) => route.pattern)).toEqual([
      "/static/fixed",
      "/dynamic/[value]",
      "/maybe/[[value]]",
      "/catch/[...value]",
      "/optional/[[...value]]"
    ]);
  });

  it.each([
    ["flat/index alias", [file("about.page.ts"), file("about/index.page.ts")]],
    ["renamed parameter", [file("blog/[slug].page.ts"), file("blog/[id].page.ts")]],
    ["transparent group", [file("pricing.page.ts"), file("(marketing)/pricing.page.ts")]],
    ["optional shadow", [file("[[lang]]/welcome.page.ts"), file("welcome.page.ts")]],
    ["optional catch-all shadow", [file("files/[[...rest]].page.ts"), file("files.page.ts")]]
  ])("reports every file in a %s collision", (_name, records) => {
    expect(() => parseRouteGraph(records)).toThrow(RouteParseError);
    try {
      parseRouteGraph(records);
    } catch (error) {
      expect(error).toBeInstanceOf(RouteParseError);
      expect((error as RouteParseError).diagnostics.map((item) => item.file).sort()).toEqual(
        records.map((record) => record.relativePath).sort()
      );
    }
  });

  it("permits a page and endpoint to share a URL while retaining distinct roles", () => {
    const graph = parseRouteGraph([file("health.page.ts"), file("health.endpoint.ts", "endpoint")]);
    expect(graph.routes).toHaveLength(2);
  });

  it.each([
    "[].page.ts",
    "[...bad-name].page.ts",
    "broken[part].page.ts"
  ])("rejects invalid segment grammar in %s", (path) => {
    expect(() => parseRouteGraph([file(path)])).toThrow(RouteParseError);
  });

  it("rejects non-final catch-all segments", () => {
    expect(() => parseRouteGraph([file("[...path]/tail.page.ts")])).toThrow(RouteParseError);
  });

  it("is independent of scanner record order", () => {
    const records = [file("z.page.ts"), file("[id].page.ts"), file("a.page.ts")];
    expect(parseRouteGraph(records)).toEqual(parseRouteGraph([...records].reverse()));
  });
});
