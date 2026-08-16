// FW-004 route convention evaluation: the shared logical route set.
//
// Every candidate convention must be able to express exactly this set. Keeping the
// logical set fixed is what makes the per-convention measurements comparable: the
// conventions differ only in how they spell these routes on disk.
//
// The set is taken from the proposed tree and the eleven segment types in
// docs/03_ROUTING_AND_NAVIGATION.md so that no candidate is measured against a
// route shape the PRD does not require.

/**
 * One logical route, independent of any filesystem spelling.
 *
 * `group` marks a URL-transparent organisational grouping. `segments` records
 * which PRD segment types the route exercises, so a convention that cannot spell
 * a segment type is visible rather than silently dropped.
 */
export const LOGICAL_ROUTES = [
  { id: "home", pattern: "/", kind: "page", group: null, segments: ["static"] },
  { id: "about", pattern: "/about", kind: "page", group: null, segments: ["static"] },
  { id: "blog.index", pattern: "/blog", kind: "page", group: null, segments: ["static"] },
  { id: "blog.post", pattern: "/blog/[slug]", kind: "page", group: null, segments: ["dynamic"] },
  {
    id: "docs.tree",
    pattern: "/docs/[...path]",
    kind: "page",
    group: null,
    segments: ["catch-all"]
  },
  {
    id: "marketing.pricing",
    pattern: "/pricing",
    kind: "page",
    group: "marketing",
    segments: ["static", "group"]
  },
  {
    id: "localised.home",
    pattern: "/[[lang]]/welcome",
    kind: "page",
    group: null,
    segments: ["optional", "static"]
  },
  {
    id: "files.browser",
    pattern: "/files/[[...rest]]",
    kind: "page",
    group: null,
    segments: ["static", "optional-catch-all"]
  },
  { id: "api.users", pattern: "/api/users", kind: "endpoint", group: null, segments: ["static"] }
];

/**
 * Layout, error, and loading boundaries the same fixture needs. `scope` is the
 * route subtree the boundary applies to, expressed as a URL prefix.
 */
export const LOGICAL_BOUNDARIES = [
  { id: "root.layout", kind: "layout", scope: "/" },
  { id: "root.error", kind: "error", scope: "/" },
  { id: "root.loading", kind: "loading", scope: "/" },
  { id: "blog.layout", kind: "layout", scope: "/blog" }
];

/**
 * Collision fixtures, expressed as logical intent rather than file paths. Each
 * entry names two logical routes that must be reported as a build-time conflict,
 * and the reason the conflict exists. `AC-ROUTE-02` requires every conflicting
 * file to be named, so the harness checks the reported file sets, not just counts.
 */
export const COLLISION_CASES = [
  {
    id: "duplicate-static",
    reason: "two files claim the same static URL",
    routes: [
      { pattern: "/about", kind: "page", variant: "flat" },
      { pattern: "/about", kind: "page", variant: "nested" }
    ]
  },
  {
    id: "renamed-dynamic-parameter",
    reason: "two dynamic segments differ only in parameter name",
    routes: [
      { pattern: "/blog/[slug]", kind: "page", variant: "flat" },
      { pattern: "/blog/[id]", kind: "page", variant: "flat" }
    ]
  },
  {
    id: "group-transparency",
    reason: "a URL-transparent group hides an otherwise obvious duplicate",
    routes: [
      { pattern: "/pricing", kind: "page", variant: "flat" },
      { pattern: "/pricing", kind: "page", variant: "grouped" }
    ]
  },
  {
    id: "optional-versus-static",
    reason: "an optional segment also matches the shorter static URL",
    routes: [
      { pattern: "/[[lang]]/welcome", kind: "page", variant: "flat" },
      { pattern: "/welcome", kind: "page", variant: "flat" }
    ]
  },
  {
    id: "optional-catch-all-versus-index",
    reason: "an optional catch-all also matches its own parent URL",
    routes: [
      { pattern: "/files/[[...rest]]", kind: "page", variant: "flat" },
      { pattern: "/files", kind: "page", variant: "flat" }
    ]
  }
];
