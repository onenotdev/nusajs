import { describe, expect, it } from "vitest";
import { createRouteMatcher } from "../src/index.js";
import type { MatchRoute } from "../src/index.js";

const score = {
  "optional-catch-all": 0,
  "catch-all": 1,
  optional: 2,
  dynamic: 3,
  static: 4
} as const;

function route(
  pattern: string,
  kinds: readonly (readonly [keyof typeof score, string])[],
  kind: MatchRoute["kind"] = "page"
): MatchRoute {
  return Object.freeze({
    kind,
    pattern,
    segments: Object.freeze(
      kinds.map(([segmentKind, value]) => Object.freeze({ kind: segmentKind, value }))
    ),
    specificity: Object.freeze(kinds.map(([segmentKind]) => score[segmentKind])),
    file: `${pattern.slice(1) || "index"}.${kind}.ts`
  });
}

const routes = [
  route("/", []),
  route("/blog/new", [
    ["static", "blog"],
    ["static", "new"]
  ]),
  route("/blog/[slug]", [
    ["static", "blog"],
    ["dynamic", "slug"]
  ]),
  route("/[[lang]]/welcome", [
    ["optional", "lang"],
    ["static", "welcome"]
  ]),
  route("/docs/[...path]", [
    ["static", "docs"],
    ["catch-all", "path"]
  ]),
  route("/files/[[...rest]]", [
    ["static", "files"],
    ["optional-catch-all", "rest"]
  ]),
  route("/health", [["static", "health"]], "page"),
  route("/health", [["static", "health"]], "endpoint")
] as const;

describe("universal route matcher", () => {
  it("matches every segment kind with parser-derived precedence", () => {
    const matcher = createRouteMatcher([...routes].reverse());
    expect(matcher.match("/", "page")?.route.pattern).toBe("/");
    expect(matcher.match("/blog/new", "page")?.route.pattern).toBe("/blog/new");
    expect(matcher.match("/blog/hello", "page")?.params).toEqual({ slug: "hello" });
    expect(matcher.match("/welcome", "page")?.params).toEqual({});
    expect(matcher.match("/id/welcome", "page")?.params).toEqual({ lang: "id" });
    expect(matcher.match("/docs/a/b", "page")?.params).toEqual({ path: "a/b" });
    expect(matcher.match("/docs", "page")).toBeUndefined();
    expect(matcher.match("/files", "page")?.params).toEqual({});
    expect(matcher.match("/files/a/b", "page")?.params).toEqual({ rest: "a/b" });
  });

  it("keeps page and endpoint roles distinct", () => {
    const matcher = createRouteMatcher(routes);
    expect(matcher.match("/health", "page")?.route.kind).toBe("page");
    expect(matcher.match("/health", "endpoint")?.route.kind).toBe("endpoint");
  });

  it("normalizes UTF-8 segments to NFC and preserves case sensitivity", () => {
    const matcher = createRouteMatcher([
      route("/café", [["static", "café"]]),
      route("/[value]", [["dynamic", "value"]])
    ]);
    expect(matcher.match("/cafe%CC%81", "page")?.route.pattern).toBe("/café");
    expect(matcher.match("/%E2%9C%93", "page")?.params).toEqual({ value: "✓" });
    expect(matcher.match("/CAF%C3%89", "page")?.route.pattern).toBe("/[value]");
  });

  it.each([
    "",
    "about",
    "https://example.test/about",
    "/about?x=1",
    "/about#part",
    "//about",
    "/a//b",
    "/about/",
    "/a\\b",
    "/%",
    "/%2",
    "/%GG",
    "/%2f",
    "/%2F",
    "/%5c",
    "/%255c",
    "/%252f",
    "/.",
    "/..",
    "/%2e",
    "/%2E%2e",
    "/%00",
    "/%1f",
    "/%7f",
    "/%C0%AF",
    "/%ED%A0%80"
  ])("fails closed for malicious pathname %j", (pathname) => {
    expect(createRouteMatcher(routes).match(pathname, "page")).toBeUndefined();
  });

  it("enforces pathname and segment bounds", () => {
    const matcher = createRouteMatcher(routes);
    expect(matcher.match(`/${"a".repeat(8192)}`, "page")).toBeUndefined();
    expect(
      matcher.match(`/${Array.from({ length: 257 }, () => "a").join("/")}`, "page")
    ).toBeUndefined();
  });

  it("copies ordering and freezes every successful output", () => {
    const mutable = [...routes].reverse();
    const matcher = createRouteMatcher(mutable);
    mutable.length = 0;
    const match = matcher.match("/blog/post", "page");
    expect(match?.route.pattern).toBe("/blog/[slug]");
    expect(Object.isFrozen(matcher)).toBe(true);
    expect(Object.isFrozen(matcher.routes)).toBe(true);
    expect(Object.isFrozen(match)).toBe(true);
    expect(Object.isFrozen(match?.params)).toBe(true);
    expect(Object.getPrototypeOf(match?.params)).toBeNull();
  });

  it.each([
    ["bad score", route("/[id]", [["dynamic", "id"]]), [4]],
    [
      "duplicate params",
      route("/[id]/[id]", [
        ["dynamic", "id"],
        ["dynamic", "id"]
      ]),
      undefined
    ]
  ])("rejects invalid route metadata: %s", (_name, value, specificity) => {
    const candidate = specificity === undefined ? value : { ...value, specificity };
    expect(() => createRouteMatcher([candidate])).toThrow("[NUSA-ROUTE-0001]");
  });
});
