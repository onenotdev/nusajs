import { describe, expect, it } from "vitest";
import { createRouteMatcher, type MatchRoute } from "../src/index.js";
import { rawPathnameCorpus } from "./malicious-url-corpus.js";

function route(
  pattern: string,
  segments: readonly Readonly<MatchRoute["segments"][number]>[],
  specificity: readonly number[]
): MatchRoute {
  return Object.freeze({
    kind: "page",
    pattern,
    segments: Object.freeze(segments.map((segment) => Object.freeze({ ...segment }))),
    specificity: Object.freeze([...specificity]),
    file: `${pattern.slice(1) || "index"}.page.ts`
  });
}

const referenceRoutes: readonly MatchRoute[] = Object.freeze([
  route("/", [], []),
  route("/[...rest]", [{ kind: "catch-all", value: "rest" }], [1]),
  route("/[[...rest]]", [{ kind: "optional-catch-all", value: "rest" }], [0])
]);

describe("shared malicious URL corpus (matcher)", () => {
  it("covers the required attack categories with named cases", () => {
    const names = rawPathnameCorpus.map((entry) => entry.name);
    for (const category of [
      "encoded slash",
      "double-encoded slash",
      "encoded backslash",
      "dot-dot segment",
      "traversal with slash",
      "overlong UTF-8",
      "lone UTF-8 surrogate",
      "duplicate slash",
      "trailing slash",
      "literal backslash",
      "query syntax",
      "fragment syntax",
      "protocol-relative",
      "oversized pathname",
      "too many segments"
    ]) {
      expect(
        names.some((name) => name.includes(category)),
        category
      ).toBe(true);
    }
  });

  it.each(rawPathnameCorpus)("$name: %j fails closed when required", ({ pathname, mustReject }) => {
    const matcher = createRouteMatcher(referenceRoutes);
    const match = matcher.match(pathname, "page");
    if (mustReject) {
      expect(match, pathname).toBeUndefined();
    } else {
      expect(match, pathname).not.toBeUndefined();
    }
  });
});
