// FW-004 route convention evaluation: the candidate filesystem conventions.
//
// Each candidate can spell the whole logical route set from ./fixtures/logical-routes.mjs.
// The candidates differ only in how a URL is encoded into a path, which is exactly
// what ADR-003 has to choose between.
//
// `spellings()` deliberately returns *every* legal path for one URL. A convention
// that admits more than one spelling for the same URL has an aliasing surface, and
// aliasing is the mechanism behind most of the collision cases in the fixture.

/**
 * Split a URL pattern into its segments. `/` yields an empty array.
 *
 * @param {string} pattern
 * @returns {string[]}
 */
function segmentsOf(pattern) {
  return pattern.split("/").filter((segment) => segment.length > 0);
}

/**
 * Suffix convention, as proposed in docs/03_ROUTING_AND_NAVIGATION.md.
 * Route role lives in a filename suffix; boundaries use an underscore prefix.
 */
const suffixConvention = {
  id: "suffix",
  title: "Option A — role in the filename suffix (`about.page.tsx`, `_layout.tsx`)",
  reserved: [
    ".page.*",
    ".endpoint.*",
    "_layout.*",
    "_error.*",
    "_loading.*",
    "index.page.*",
    "(group)/",
    "[param]",
    "[[param]]",
    "[...rest]",
    "[[...rest]]"
  ],
  groupAliasing: true,
  precedenceSource: "computed from the parsed pattern",
  spellings(route) {
    const segments = segmentsOf(route.pattern);
    const suffix = route.kind === "endpoint" ? "endpoint.ts" : "page.tsx";
    const prefix = route.group === null ? "" : `(${route.group})/`;
    if (segments.length === 0) {
      return [`${prefix}index.${suffix}`];
    }
    const head = segments.slice(0, -1);
    const last = segments[segments.length - 1];
    const flat = [...head, `${last}.${suffix}`].join("/");
    const nested = [...head, last, `index.${suffix}`].join("/");
    return [`${prefix}${flat}`, `${prefix}${nested}`];
  },
  spellBoundary(boundary) {
    const segments = segmentsOf(boundary.scope);
    const name = `_${boundary.kind}.tsx`;
    return [...segments, name].join("/");
  }
};

/**
 * Folder-per-route convention. The directory encodes the URL and a fixed filename
 * encodes the role, so a URL has exactly one spelling inside a given group.
 */
const folderConvention = {
  id: "folder",
  title: "Option B — role in a fixed filename inside a route folder (`about/page.tsx`)",
  reserved: [
    "page.*",
    "endpoint.*",
    "layout.*",
    "error.*",
    "loading.*",
    "(group)/",
    "[param]",
    "[[param]]",
    "[...rest]",
    "[[...rest]]"
  ],
  groupAliasing: true,
  precedenceSource: "computed from the parsed pattern",
  spellings(route) {
    const segments = segmentsOf(route.pattern);
    const file = route.kind === "endpoint" ? "endpoint.ts" : "page.tsx";
    const prefix = route.group === null ? "" : `(${route.group})/`;
    return [`${prefix}${[...segments, file].join("/")}`];
  },
  spellBoundary(boundary) {
    const segments = segmentsOf(boundary.scope);
    return [...segments, `${boundary.kind}.tsx`].join("/");
  }
};

/**
 * Explicit manifest convention. Filenames carry no routing meaning; a single
 * checked-in module maps URL patterns to modules. Route identity comes from the
 * manifest, so the filesystem contributes no aliasing and no reserved names.
 */
const manifestConvention = {
  id: "manifest",
  title: "Option C — explicit route manifest, no filesystem meaning",
  reserved: ["routes.config.ts"],
  groupAliasing: false,
  precedenceSource: "declaration order in the manifest",
  spellings(route) {
    return [`modules/${route.id}.tsx`];
  },
  spellBoundary(boundary) {
    return `modules/${boundary.id}.tsx`;
  }
};

export const CONVENTIONS = [suffixConvention, folderConvention, manifestConvention];

/**
 * Specificity comparator shared by the filesystem conventions. Higher is more
 * specific. The scores exist so that precedence is a pure function of the pattern:
 * docs/03_ROUTING_AND_NAVIGATION.md forbids filesystem enumeration order from
 * deciding precedence, so any tie is a defect the harness must surface.
 *
 * @param {string} segment
 * @returns {number}
 */
function segmentScore(segment) {
  if (segment.startsWith("[[...")) {
    return 0;
  }
  if (segment.startsWith("[...")) {
    return 1;
  }
  if (segment.startsWith("[[")) {
    return 2;
  }
  if (segment.startsWith("[")) {
    return 3;
  }
  return 4;
}

/**
 * Compute the specificity key of a URL pattern as a list of per-segment scores.
 *
 * @param {string} pattern
 * @returns {number[]}
 */
export function specificityKey(pattern) {
  return segmentsOf(pattern).map(segmentScore);
}

/**
 * Compare two specificity keys. Returns a negative number when `a` is less
 * specific, zero when the two are indistinguishable, positive otherwise.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function compareSpecificity(a, b) {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? -1;
    const right = b[index] ?? -1;
    if (left !== right) {
      return left - right;
    }
  }
  return 0;
}
